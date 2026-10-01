// Routes bound to a path prefix (sidharthpatel.com/projects/kalman-radar*)
// don't automatically strip that prefix before looking up static assets —
// the asset files are uploaded at the root of `dist/`, not under a matching
// `projects/kalman-radar/` subfolder. This worker strips the prefix itself
// before delegating to the ASSETS binding.
const PREFIX = '/projects/kalman-radar';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === PREFIX) {
      // No trailing slash: redirect so relative asset URLs in index.html resolve correctly.
      url.pathname = PREFIX + '/';
      return Response.redirect(url.toString(), 308);
    }

    url.pathname = url.pathname.startsWith(PREFIX + '/') ? url.pathname.slice(PREFIX.length) : '/';
    return env.ASSETS.fetch(new Request(url, request));
  },
};
