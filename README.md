# A minimalist free commenting system built with Cloudflare Workers using Workers KV

This commenting system is built to be as simple as possible. It consists of one endpoint and a couple of lines of inlined JS. **It sits on top of Cloudflare Workers, which makes it free** for the vast majority of blogs.

[You can see it in action on my blog.](https://antoinefink.com/simple-commenting-system-static-website)

A single /comments endpoint is used:
* POST requests create comments
* GET requests retrieve all the comments for an article (using /comments/my-article-url).

```js
<script defer>
  fetch('https://antoinefink.com/comments{{ page.url }}')
    .then(response => {
        if (response.ok) {
          return response.text()
        } else {
          throw new Error('Something went wrong')
        }
      }).then(body => {
      document.getElementById("comments-list").innerHTML = body
    })
</script>
```

If the ZAPIER_URL environment variable URL is set, all comments' data is sent to the webhook to, for example, help with moderation.

## Getting started

Just add a wrangler.toml file and publish the worker. If you're new to this, check out:
* Getting started with [Cloudflare Workers](https://developers.cloudflare.com/workers/get-started/guide).
* The Wrangler [documentation](https://developers.cloudflare.com/workers/tooling/wrangler).

