

CREATE DATABASE IF NOT EXISTS sit_monitoring;
USE sit_monitoring;


CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_number   CHAR(8) NOT NULL UNIQUE,
  last_name   VARCHAR(100) NOT NULL,
  first_name  VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  course_level TINYINT NOT NULL,
  password    VARCHAR(255) NOT NULL,
  email       VARCHAR(150),
  course      VARCHAR(150),
  address     VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
