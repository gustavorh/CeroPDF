import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on every path EXCEPT Next.js internals, public assets, and the API.
  // We keep /api unaffected so server proxies don't get a locale prefix.
  matcher: [
    "/((?!api|_next|_vercel|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
