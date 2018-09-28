const express = require("express");
const app = express();
const bodyParser = require('body-parser')
const ejsEngine = require('ejs-mate');
const path = require('path')
const port = process.env.PORT || 8080;

// We have this module in order to utilize async/await keyword on route callbacks
const asyncHandler = require('express-async-handler')
let cloudant = require('@cloudant/cloudant');
const fs = require('fs');
const dbCredentials = {
    dbName: 'testdb'
}

// this is our DB Link
let db; // << 

function getDBCredentialsUrl(jsonData) {
    var vcapServices = JSON.parse(jsonData);
    for (var vcapService in vcapServices) {
        if (vcapService.match(/cloudant/i)) {
            return vcapServices[vcapService][0].credentials.url;
        }
    }
}



function initDBConnection() {

    if (process.env.VCAP_SERVICES) {
        dbCredentials.url = getDBCredentialsUrl(process.env.VCAP_SERVICES);
    } else { //When running locally, the VCAP_SERVICES will not be set
        dbCredentials.url = getDBCredentialsUrl(fs.readFileSync("vcap-local.json", "utf-8"));
    }

    cloudant = cloudant({ url: dbCredentials.url, plugins: 'promises' });

    // check if DB exists if not create
    cloudant.db.create(dbCredentials.dbName, function (err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbName + ', it might already exist.');
        }
    });

    db = cloudant.use(dbCredentials.dbName);
}

initDBConnection();


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


// LANDING ZONE 
app.get('/', asyncHandler(async (request, res) => {

    let items = await db.list({ include_docs: true });

    items.rows = items.rows.sort(({ doc: docA }, { doc: docB }) => {
        return docB.order > docA.order ? 1 : docB.order == docA.order
    });

    res.render('homepage', {
        title: 'LandingZone - ',
        items
    });
}));

app.post('/db/new', asyncHandler(async (request, response) => {

    // retrieve data that we sent to the route 
    const { title, url } = request.body;

    // create an object which holds the data 
    const newDocumentToBe = {
        title,
        url
    }

    // send the object to the database as an insert 
    const dbResponse = await db.insert(newDocumentToBe, null)

    // send back the response of the database to the user 
    response.send(`${JSON.stringify(dbResponse)} \n`)

}));

app.get('/db/list', asyncHandler(async (request, res) => {
    // ask the db to show us all the contents
    let listOfDocuments = await db.list({ include_docs: true });
    res.send(listOfDocuments);
}));

app.listen(port);
console.log("Listening on port ", port);

require("cf-deployment-tracker-client").track();