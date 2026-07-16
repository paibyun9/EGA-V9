import { createCheckoutApp } from "./app.mjs";

const port = Number(process.env.PORT ?? 3001);
const app = createCheckoutApp();

app.listen(port, () => {
  console.log(
    `EGA V9 Express demo listening at http://localhost:${port}`
  );
  console.log(
    `POST a workflow to http://localhost:${port}/checkout`
  );
});
