const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const ejsEngine = require("ejs-mate");
const path = require("path");
const port = process.env.PORT || 8080;

// We have this module in order to utilize async/await keyword on route callbacks
const asyncHandler = require("express-async-handler");
let cloudant = require("@cloudant/cloudant");
const fs = require("fs");
const dbCredentials = {
  dbName: "testdb"
};

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
  } else {
    //When running locally, the VCAP_SERVICES will not be set
    dbCredentials.url = getDBCredentialsUrl(
      fs.readFileSync("vcap-local.json", "utf-8")
    );
  }

  cloudant = cloudant({ url: dbCredentials.url, plugins: "promises" });

  // check if DB exists if not create
  cloudant.db.create(dbCredentials.dbName, function(err, res) {
    if (err) {
      console.log(
        "Could not create new db: " +
          dbCredentials.dbName +
          ", it might already exist."
      );
    }
  });

  db = cloudant.use(dbCredentials.dbName);
}

initDBConnection();

app.engine("ejs", ejsEngine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/sayHello", function(request, response) {
  var user_name = request.query.user_name;
  response.end("Hello " + (user_name || '"World"') + "!");
});

// LANDING ZONE
app.get(
  "/",
  asyncHandler(async (request, res) => {
    service.message(
      {
        workspace_id: workspace_id,
        context: context
      },
      async function(er, response) {
        let items = await db.list({ include_docs: true });

        items.rows = items.rows.sort(({ doc: docA }, { doc: docB }) => {
          return +new Date(docB.created_at) > +new Date(docA.created_at)
            ? 1
            : +new Date(docB.created_at) == +new Date(docA.created_at);
        });

        res.render("homepage", {
          title: "LandingZone - ",
          chatbot: response.output.text[0],
          items
        });
      }
    );
  })
);

app.post(
  "/db/new",
  asyncHandler(async (request, response) => {
    // retrieve data that we sent to the route
    const { title, url } = request.body;

    // create an object which holds the data
    const newDocumentToBe = {
      title,
      url
    };

    // send the object to the database as an insert
    const dbResponse = await db.insert(newDocumentToBe, null);

    // send back the response of the database to the user
    response.send(`${JSON.stringify(dbResponse)} \n`);
  })
);

app.get(
  "/db/list",
  asyncHandler(async (request, res) => {
    // ask the db to show us all the contents
    let listOfDocuments = await db.list({ include_docs: true });
    res.send(listOfDocuments);
  })
);

/// WATSON
let envvars;
if (process.env.VCAP_SERVICES) {
  envvars = JSON.parse(process.env.VCAP_SERVICES);
} else {
  //When running locally, the VCAP_SERVICES will not be set
  envvars = JSON.parse(fs.readFileSync("vcap-local.json", "utf-8"));
}

const AssistantV1 = require("watson-developer-cloud/assistant/v1");

// Set up Assistant service wrapper.
var service = new AssistantV1({
  username: "apikey", // replace with service username
  password: envvars.conversation[0].credentials.apikey, // replace with service password
  version: "2018-02-16"
});
var workspace_id = process.env.WORKSPACE_ID; // replace with workspace ID

// Context - previous conversation steps
let context;

// Process the service response.
function processResponse(err, response) {
  if (err) {
    console.error(err); // something went wrong
    return false;
  }

  context = response.context;

  // If an intent was detected, log it out to the console.
  if (response.intents.length > 0) {
    console.log("Detected intent: #" + response.intents[0].intent);
  }

  // Display the output from dialog, if any.
  if (response.output.text.length != 0) {
    console.log(response.output.text[0]);
  }

  return true;
}

app.post(
  "/api/watson",
  asyncHandler(async function(httpReq, httpRes) {
    service.message(
      {
        workspace_id: workspace_id,
        input: { text: httpReq.body.text },
        context: context
      },
      (er, response) => {
        if (!processResponse(er, response)) {
          httpRes.json({
            error: true,
            errorMessage: er
          });
        }

        // message from watson
        httpRes.json({
          error: false,
          text: response.output.text[0]
        });
      }
    );
  })
);

app.listen(port);
console.log("Listening on port ", port);

require("cf-deployment-tracker-client").track();
