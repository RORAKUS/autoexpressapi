# Auto express API
Auto express API is a simple javascript library. It's used for directory-based express routing. <br>
Documentation: [*In progress*](https://github.com/RORAKUS/autoexpressapi/wiki) <br>
Quick guide: *In progress*

## Usage
1. Install - `npm install autoexpressapi`
2. Reference in your main script:
    ```ts
    import autoExpressAPI from "autoexpressapi";
    // ... initalize express server as app
    autoExpressAPI(app);
    // ... start the server
    ```

### Hello world example
index.ts:
```ts
import autoExpressAPI from "autoexpressapi";
import express from "express";

const app = express();
autoExpressAPI(app);

app.listen(3000);
```
routes/index.ts
```ts
import {Route} from "autoexpressapi";

export = <Route>{
    get: (req, res, next) => {
        res.send("Hello, world!");
        next();
    }
};
```
When you run it and go to `localhost:3000`, you will see the *"Hello, world!* message.