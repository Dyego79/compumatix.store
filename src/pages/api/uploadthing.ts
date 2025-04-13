import { createRouteHandler } from "uploadthing/server";
import { ourFileRouter } from "@/server/uploadthing";

const handlers = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: import.meta.env.UPLOADTHING_TOKEN,
  },
});

export const GET = handlers;
export const POST = handlers;
