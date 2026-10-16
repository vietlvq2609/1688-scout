# 1688 Scout

A Chrome extension that helps a Shopee Vietnam seller find 1688 offers worth importing.

This file is the single source of truth for the project's language. Code, tickets, SPEC.md
and user-facing copy use these words and no synonyms. If a term for a concept is missing
here, add it here first, then use it.

## Language

### The two marketplaces

**Product**:
A listing on Shopee, the thing a seller is thinking of selling.
_Avoid_: item, article, listing

**Offer**:
A single listing on 1688, with its own price, minimum order quantity and shop.
_Avoid_: product, item, listing

**Category**:
One Shopee listing page. A scan covers exactly one category.
_Avoid_: collection, department, section

### Deciding what is worth importing

**Landed cost**:
The 1688 price converted to VND and multiplied by the markup. The number compared against the Shopee price.
_Avoid_: calculated price, import price, total cost

**Markup**:
The multiplier applied to a converted 1688 price to reach a landed cost.
_Avoid_: margin, fee, uplift

**Match**:
An offer whose landed cost is below the Shopee price of the product it was found for.
_Avoid_: hit, result, opportunity

**Best match**:
The first offer 1688 returns for an image. A scan treats the best match as *the* offer for that product.
_Avoid_: top result, closest match, cheapest

### The work itself

**Scan**:
One run of the tool over a single category. A scan performs one search per product.
_Avoid_: job, batch, crawl, research

**Search**:
Looking one product image up on 1688.
_Avoid_: lookup, query, image query

**Helper**:
The local program on the seller's own machine that does all browsing and produces the spreadsheet.
_Avoid_: backend, server, bot, scraper

### Being signed in

**Session**:
The expiring proof a site accepts that the seller is signed in. It must be valid when a scan starts, and it outlives no particular scan.
_Avoid_: login, credentials, auth, token, cookie

**Login**:
The act of creating a session by proving identity.
_Avoid_: authenticate, credential entry, auth flow

**Hand-off**:
Passing the seller's own browser session to the helper for the duration of a scan, instead of the helper signing in for itself.
_Avoid_: cookie injection, cookie sharing, session sync
