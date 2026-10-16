# 1688 Scout

A Chrome extension that helps a Shopee Vietnam seller find 1688 offers worth importing.

## Language

**Seller**:
The person using the tool to decide what to import for their Shopee shop.
_Avoid_: user, client, customer

**Helper**:
The local program on the seller's own machine that does all browsing and produces the spreadsheet.
_Avoid_: backend, server, bot, scraper

**Scan**:
One run of the tool over a single Shopee category.
_Avoid_: job, batch, crawl, research

**Search**:
Looking one product image up on 1688. A scan performs one search per product.
_Avoid_: lookup, query

**Offer**:
A single listing on 1688, with its own price, minimum order quantity and shop.
_Avoid_: product, item, listing

**Match**:
A 1688 offer whose landed cost is below the Shopee price of the product it was found for.
_Avoid_: hit, result, opportunity

**Landed cost**:
The 1688 price converted to VND and multiplied by the markup. This is the number compared against the Shopee price.
_Avoid_: calculated price, import price, total cost

**Session**:
The expiring proof a site accepts that the seller is signed in. It outlives no particular scan and must be valid when a scan starts.
_Avoid_: login, credentials, auth, token

**Login**:
The act of creating a session by proving identity.
_Avoid_: authenticate, credential entry, auth flow

**Hand-off**:
Passing the seller's own browser session to the helper for the duration of a scan, instead of the helper signing in for itself.
_Avoid_: cookie injection, cookie sharing, session sync
