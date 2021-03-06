const mysql  = require('mysql');


if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
};

let host = process.env.MYSQL_HOST;
let user = process.env.MYSQL_USER;
let password = process.env.MYSQL_PASSWORD || '';
let port = process.env.MYSQL_PORT || '';

const connection = mysql.createConnection({
  host     : host,
  user     : user,
  password : password,
  port     : port,
  multipleStatements: true
});

connection.connect((err) => {
  if(!err) {
      console.log("Database is connected ... ");
  } else {
      console.log("Error connecting database ... ");
  }
});

let currentDB = `${process.env.NODE_ENV === 'test'
                ? 'beachrnrtesting'
                : 'beachrnr'}`;


let query = `
  CREATE DATABASE IF NOT EXISTS ${currentDB};

  USE ${currentDB};

  CREATE TABLE IF NOT EXISTS user(
    id BIGINT(8) UNSIGNED AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    avatar VARCHAR(500) NOT NULL,
    PRIMARY KEY (id)
  );

  CREATE TABLE IF NOT EXISTS listing_review(
    id BIGINT(8) UNSIGNED AUTO_INCREMENT,
    review_count INT(8) NOT NULL DEFAULT 0,
    rating_count INT(8) NOT NULL DEFAULT 0,
    average_rating DOUBLE NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
  );

  ALTER TABLE listing_review AUTO_INCREMENT = 2912000;

  CREATE TABLE IF NOT EXISTS review(
    id BIGINT(8) UNSIGNED AUTO_INCREMENT,
    user_id BIGINT(8) UNSIGNED NOT NULL,
    listing_review_id BIGINT(8) UNSIGNED NOT NULL,
    review_content VARCHAR(1000) NOT NULL,
    review_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (listing_review_id) REFERENCES listing_review (id)
  );

  CREATE TABLE IF NOT EXISTS review_report(
    id BIGINT(8) UNSIGNED AUTO_INCREMENT,
    user_id BIGINT(8) UNSIGNED NOT NULL,
    review_id BIGINT(8) UNSIGNED NOT NULL,
    report_content VARCHAR(1000) NOT NULL,
    report_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (review_id) REFERENCES review(id),
    CONSTRAINT unique_report UNIQUE (user_id, review_id)
  );

  CREATE TABLE IF NOT EXISTS rating_type(
    id INT(8) UNSIGNED AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    PRIMARY KEY (id)
  );

  CREATE TABLE IF NOT EXISTS review_rating(
    id BIGINT(8) UNSIGNED AUTO_INCREMENT,
    review_id BIGINT(8) UNSIGNED NOT NULL,
    rating_type_id INT(8) UNSIGNED NOT NULL,
    star_ratings TINYINT(1) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (review_id) REFERENCES review(id),
    FOREIGN KEY (rating_type_id) REFERENCES rating_type(id),
    CONSTRAINT unique_review_rating_type UNIQUE (review_id, rating_type_id)
  );

  CREATE TABLE IF NOT EXISTS listing_attribute_rating(
    id BIGINT(8) UNSIGNED AUTO_INCREMENT,
    listing_review_id BIGINT(8) UNSIGNED NOT NULL,
    rating_type_id INT(8) UNSIGNED NOT NULL,
    rating_review_count INT(8) UNSIGNED NOT NULL,
    average_star_rating DOUBLE NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY (listing_review_id) REFERENCES listing_review (id),
    FOREIGN KEY (rating_type_id) REFERENCES rating_type(id),
    CONSTRAINT unique_attr_rating UNIQUE (listing_review_id, rating_type_id)
  );
`

module.exports.setupDatabase = () => {
  connection.query(query)
};


module.exports.setupDatabase();

module.exports.dropTestingDatabase = (cb) => {
  let q = `DROP DATABASE IF EXISTS beachrnrtesting`;
  connection.query(q, [], (err, results, fields) => {
    err ? cb(err, null) : cb(null, results);
  });
}

module.exports.createUser = (users, cb) => {
  let q = 'INSERT INTO user SET ?';
  users.forEach((user => {
    connection.query(q, user, (err, results, fields) => {
      err ? cb(err, null) : cb(null, results);
    })
  }));
};

module.exports.createListing = (listingIDs, cb) => {
  let q = 'INSERT INTO listing_review SET ?';
  listingIDs.forEach((listing => {
    connection.query(q, listing, (err, results, fields) => {
      err ? cb(err, null) : cb(null, results);
    })
  }));
};

module.exports.updateListingReviewCount = (list_review_id, cb) => {
  let q = `UPDATE listing_review SET review_count = review_count + 1 WHERE id = ?`;
  connection.query(q, [list_review_id], (err, results, fields) => {
    err ? cb(err, null) : cb(null, results);
  });
};

module.exports.createReview = (review, cb) => {
  let q = 'INSERT INTO review SET ?';
  connection.query(q, review, (err, results, fields) => {
      if(err) {cb(err, null, review)};
      if(results) {
          cb(null, results, review);
          module.exports.updateListingReviewCount(review.listing_review_id, (err2, results2) => {
        });
      }
  })
};

module.exports.createReviews = (reviews, cb) => {
  reviews.forEach(review => {
    module.exports.createReview(review, cb);
  });
};

module.exports.createReviewReport = (reviewReps, cb) => {
  let q = 'INSERT INTO review_report SET ?';
  reviewReps.forEach((reviewRep => {
    connection.query(q, reviewRep, (err, results, fields) => {
      err ? cb(err, null) : cb(null, results);
    })
  }));
};


module.exports.createReviewRating = (reviewRating, listing_review_id, cb) => {
  let q = `INSERT INTO review_rating SET ?;
          INSERT INTO listing_attribute_rating (listing_review_id, rating_type_id, rating_review_count, average_star_rating)
          VALUES (${listing_review_id}, ${reviewRating.rating_type_id}, 1, ${reviewRating.star_ratings})
          ON DUPLICATE KEY
          UPDATE
            average_star_rating = (average_star_rating * rating_review_count + ${reviewRating.star_ratings}) / (rating_review_count + 1),
            rating_review_count = rating_review_count + 1;

          UPDATE listing_review
           SET
             average_rating = (average_rating * rating_count +
                                      (SELECT average_star_rating
                                        FROM listing_attribute_rating
                                        WHERE listing_review_id = ${listing_review_id}
                                          AND rating_type_id = ${reviewRating.rating_type_id})
                              ) / (rating_count + 1),
             rating_count = rating_count + 1
           WHERE id = ${listing_review_id};
        `;
  connection.query(q, [reviewRating], (err, results, fields) => {
                        err ? cb(err, null) : cb(null, results);
                  });
};

module.exports.createReviewRatings = (reviewRatings, listing_review_id, cb) => {
  reviewRatings.forEach(reviewRating => {module.exports.createReviewRating(reviewRating, listing_review_id, cb)});
};

module.exports.createRatingType = (ratingTypes, cb) => {
  let q = 'INSERT INTO rating_type SET ?';
  ratingTypes.forEach((ratingType => {
    connection.query(q, ratingType, (err, results, fields) => {
      err ? cb(err, null) : cb(null, results);
    })
  }));
};

module.exports.readRatingNReviewCount = (listingId, cb) => {

  let q = `SELECT review_count, ROUND(average_rating, 1) AS average_rating
            FROM listing_review
            WHERE id = ?`;

  connection.query(q, [listingId], (err, results, fields) => {

    err? cb(err, null) : cb(null, results);
  });
};

module.exports.readReviewContent = (listingId, cb) => {
  let q = `SELECT U.name AS user_name, U.avatar AS user_avatar, R.id AS review_id, R.review_time AS review_time, R.review_content AS review_content
          FROM review AS R
          LEFT JOIN user AS U
          ON R.user_id = U.id
          WHERE listing_review_id = ?
          ORDER BY R.review_time DESC`;

  connection.query(q, [listingId], (err, results, fields) => {
    err? cb(err, null) : cb(null, results);
  });
};

module.exports.readReviewRatings = (listingId, cb) => {
  let q = `SELECT RT.name, ROUND(average_star_rating, 1) AS average_star_rating
            FROM listing_attribute_rating AS LAR
            LEFT JOIN rating_type AS RT
            ON LAR.rating_type_id = RT.id
            WHERE LAR.listing_review_id = ?
            ORDER BY RT.id`;
  connection.query(q, [listingId], (err, results, fields) => {
    err? cb(err, null) : cb(null, results);
  });
}


module.exports.connection = connection;








