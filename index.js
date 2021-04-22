addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handleRequest(request) {
  let response

  if (request.method === "POST") {
    response = await insertComment(request)

  } else {
    response = await listArticleComments(request)
  }

  return response
}

/**
 * Inserts a comment as a KV.
 * If the comment doesn't pass the the Akismet validation, it is rejected.
 * If the ZAPIER_URL environment variable is defined, the content of the comment
 * is submited to it.
 */
async function insertComment(request) {
  const formData = await request.formData()
  const body = {}
  for (const entry of formData.entries()) {
    body[entry[0]] = entry[1]
  }

  // If subject is set, this is a bot trying to post crap and can safely be ignored.
  if (body.subject)  {
    return Response('', { status: 400 })
  }

  const key = `${body.permalink.replace('/', '')}-${Date.now()}`

  await COMMENTS_KV.put(key, JSON.stringify({
    user_ip: request.headers.get("cf-connecting-ip"),
    user_agent: request.headers.get("User-Agent"),
    referrer: request.headers.get("Referer"),
    permalink: body.permalink,
    name: body.name,
    email: body.email,
    content: body.content,
    time: Date.now(),
  }))

  // Posting the comment to Zapier for moderation.
  fetch(ZAPIER_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: key,
      name: body.name,
      email: body.email,
      permalink: body.permalink,
      content: body.content,
    })
  })

  return new Response(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="robots" content="noindex, noarchive, nosnippet">
  </head>
  <body>
    Thank you so much for commenting! Your comment could take up to 5 minutes to appear.
    <br>
    <a href="${body.permalink}">⬅️ Go back</a>
  </body>
</html>
    `, {
      headers: {
      'content-type': 'text/html',
    },
  })
}

/**
 * Lists the article's comments.
 * To prevent going over the Cloudflare KV free limit, a cache of 5 minutes is
 * used.
 */
async function listArticleComments(request) {
  const { pathname } = new URL(request.url)

  let articleURL = pathname.replace('/comments/', '')

  if (!articleURL) {
    return new Response("", { status: 400 })
  }

  let cursor
  let content = ""
  let j = 1

  // With lists returning up to 1000 items, we'll be returning up to 5000 comments
  // which should be more than enough for most use-cases.
  for (i = 0; i < 5; i++) {
    const values = await COMMENTS_KV.list({ prefix: articleURL, limit: 1000, cursor: cursor})

    for (const key of values.keys) {
      console.log("Found comment: " + key.name)
      const jsonComment = await COMMENTS_KV.get(key.name)
      comment = JSON.parse(jsonComment)
      console.log(comment)
      content += `
        <div class="item">
          <h4><span class="grey">${j}.</span> ${sanitizeHTML(comment.name)} <span class="grey small">${new Date(comment.time).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span></h4>
          <p>${sanitizeHTML(comment.content)}</p>
        </div>
      `

      j += 1
    }

    if (values.cursor === undefined) {
      break
    }
  }

  if (j == 1) {
    content = `
      <div class="item">There aren't any comment yet.</div>
    `
  }

  return new Response(content, {
    headers: {
      'content-type': 'text/html',
      's-maxage': '300',
      'Cache-Control': 'public, max-age=300'
    },
  })
}

function sanitizeHTML(string) {
  const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      "/": '&#x2F;',
  };
  const reg = /[&<>"'/]/ig;
  return string.replace(reg, (match)=>(map[match]));
}