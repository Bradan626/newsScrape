//dependencies
var express = require("express");
var router = express.Router();
var path = require("path");

//require request and cheerio to scrape
var request = require("request");
var cheerio = require("cheerio");

//Require models
var Comment = require("../models/Comment.js");
var Article = require("../models/Article.js");

//index
router.get("/", function(req, res) {
  res.redirect("/articles");
});

// A GET request to scrape [mediumXXXXXXX(bad)] (new site the verge) website
router.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("https://theverge.com/tech", function(error, response, html) {
    //load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    var titlesArray = [];
    //  grab every article
    $(".c-entry-box--compact__title").each(function(i, element) {
      // empty result object
      var result = {};

      result.title = $(this)
        .children("a")
        .text();
      result.link = $(this)
        .children("a")
        .attr("href");

      if (result.title !== "" && result.link !== "") {
        //check for duplicates
        if (titlesArray.indexOf(result.title) == -1) {
          // push the saved title to the array
          titlesArray.push(result.title);

          Article.count({ title: result.title }, function(err, test) {
            if (test == 0) {
              var entry = new Article(result);

              entry.save(function(err, doc) {
                if (err) {
                  console.log(err);
                } else {
                  console.log(doc);
                }
              });
            }
          });
        } else {
          console.log("Article already exists.");
        }
      } else {
        console.log("Not saved to DB, missing data");
      }
    });

    res.redirect("/");
  });
});

router.get("/articles", function(req, res) {
  p;
  Article.find()
    .sort({ _id: -1 })
    //send to handlebars
    .exec(function(err, doc) {
      if (err) {
        console.log(err);
      } else {
        var artcl = { article: doc };
        res.render("index", artcl);
      }
    });
});

// articles we scraped from the mongoDB in JSON
router.get("/articles-json", function(req, res) {
  Article.find({}, function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      res.json(doc);
    }
  });
});

// clear articles(testing)
router.get("/clearAll", function(req, res) {
  Article.remove({}, function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      console.log("removed all articles");
    }
  });
  res.redirect("/articles-json");
});

router.get("/readArticle/:id", function(req, res) {
  var articleId = req.params.id;
  var hbsObj = {
    article: [],
    body: []
  };

  // //find the article at the id
  Article.findOne({ _id: articleId })
    .populate("comment")
    .exec(function(err, doc) {
      if (err) {
        console.log("Error: " + err);
      } else {
        hbsObj.article = doc;
        var link = doc.link;
        //grab article from link
        request(link, function(error, response, html) {
          var $ = cheerio.load(html);

          $(".l-col__main").each(function(i, element) {
            hbsObj.body = $(this)
              .children(".c-entry-content")
              .children("p")
              .text();
            //send article body and comments to article.handlbars through hbObj
            res.render("article", hbsObj);
            //prevents loop through so it doesn't return an empty hbsObj.body
            return false;
          });
        });
      }
    });
});

// Create a new comment
router.post("/comment/:id", function(req, res) {
  var user = req.body.name;
  var content = req.body.comment;
  var articleId = req.params.id;

  //submitted form
  var commentObj = {
    name: user,
    body: content
  };

  //using the Comment model, create a new comment
  var newComment = new Comment(commentObj);

  newComment.save(function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      console.log(doc._id);
      console.log(articleId);
      Article.findOneAndUpdate(
        { _id: req.params.id },
        { $push: { comment: doc._id } },
        { new: true }
      )
        //execute everything
        .exec(function(err, doc) {
          if (err) {
            console.log(err);
          } else {
            res.redirect("/readArticle/" + articleId);
          }
        });
    }
  });
});

module.exports = router;
