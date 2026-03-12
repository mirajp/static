# static

This repo/Github Pages website serves as a static file server for various nifty tools and utilities.

## [toolkit.js](toolkit.js)

A portable toolkit for fullstack engineers. No extensions, no bloat—just raw JS injected into the runtime to give you superpowers over the DOM, network, and layout.

### Usage

#### Bookmarklet

Option 1: Create a bookmark with the following content as the "URL":

```js
javascript:(function(){const s=document.createElement('script');s.src='https://miraj.dev/static/toolkit.js';s.onload=()=>console.log('🛠%EF%B8%8F DevKit Loaded');document.head.appendChild(s);})();
```

If you face CSP issues, try fetching the script and inlining it instead.

#### Fetch and inline the script

Option 2: Fetch the script content and inject it directly into your page:

```js
fetch('https://miraj.dev/static/toolkit.js')
    .then(r => r.text())
    .then(code => {
      const s = document.createElement('script');
      s.textContent = code;
      document.head.appendChild(s);
      console.log('Toolkit injected successfully.');
    });
```
