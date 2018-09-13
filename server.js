const express = require("express");
const app = express();
const bodyParser = require('body-parser')
const ejsEngine = require('ejs-mate');
const path = require('path')
const port = process.env.PORT || 8080;

app.engine('ejs', ejsEngine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/sayHello", function (request, response) {
    var user_name = request.query.user_name;
    response.end("Hello " + (user_name || '"World"') + "!");
});

app.get('/', (request, res) => {
    res.render('homepage', {
        title: 'LandingZone - '
    });
});

app.listen(port);
console.log("Listening on port ", port);

require("cf-deployment-tracker-client").track();