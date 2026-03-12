/**
 * DevKit - Essential Debugging Utilities
 */

/*
  // Example of how to load this toolkit in the browser console using fetch API and inject text content as an inline script:
  fetch('https://miraj.dev/static/toolkit.js')
    .then(r => r.text())
    .then(code => {
      const s = document.createElement('script');
      s.textContent = code;
      document.head.appendChild(s);
      console.log('Toolkit injected successfully.');
    });
*/

// Bookmarklet to load this toolkit on any page:
// javascript:(function(){const s=document.createElement('script');s.src='https://miraj.dev/static/toolkit.js';s.onload=()=>console.log('🛠️ DevKit Loaded');document.head.appendChild(s);})();

window.kit = (() => {
  const kit = {
    // Internal state for recording and streaming (if needed in future expansions)
    _recorder: null,
    _stream: null,
    _oldFetch: window.fetch,

    // --- 1. SELECTION & DOM ---
    // Select all elements matching selector as an actual Array
    all: (sel) => Array.from(document.querySelectorAll(sel)),

    // Find element by text content (case-insensitive)
    byText: (text, tag = '*') =>
      kit
        .all(tag)
        .find((el) =>
          el.textContent.toLowerCase().includes(text.toLowerCase()),
        ),

    // Get all React/Vue/Svelte fiber or internal data from a node
    internals: (el) => {
      const key = Object.keys(el).find(
        (k) => k.startsWith('__react') || k.startsWith('__vue'),
      );
      return el[key];
    },

    /*
     * kit.parseCTA([targetEl])
     * Extract and categorize URL parameters from the provided input argument > focused element > inspected element ($0).
     */
    parseCta: (targetEl) => {
      // 1. Determine target: argument || Focused <a> element || DevTools inspected element ($0)
      let target =
        targetEl ||
        (document.activeElement instanceof HTMLAnchorElement
          ? document.activeElement
          : null) ||
        (typeof $0 !== 'undefined' ? $0 : null);

      // 2. Extract URL string
      let urlString;
      if (typeof target === 'string') {
        // If string is a selector, get that element's href; otherwise treat as raw URL
        const el = document.querySelector(target);
        urlString = el ? el.href : target;
      } else if (target && (target.href || target.src)) {
        urlString = target.href || target.src;
      }

      if (!urlString || !urlString.includes('http')) {
        console.warn(
          '⚠️ No valid URL found on the focused or inspected element.',
        );
        return null;
      }

      try {
        const url = new URL(urlString);
        const params = Object.fromEntries(url.searchParams);

        // Categorization logic
        const cats = { attribution: {}, ids: {}, functional: {}, other: {} };
        for (const [k, v] of Object.entries(params)) {
          if (k.startsWith('utm_')) {
            cats.attribution[k] = v;
          } else if (
            [
              '_gl',
              'gclid',
              'fbclid',
              'subid',
              'msclkid',
              'ttclid',
              'li_fat_id',
            ].includes(k)
          ) {
            cats.ids[k] = v;
          } else if (['ref', 'id', 'next', 'redirect', 's', 'q'].includes(k)) {
            cats.functional[k] = v;
          } else {
            cats.other[k] = v;
          }
        }

        // Pretty Logging
        console.log(
          `%c 🎯 Path: ${url.origin}${url.pathname}`,
          'font-weight: bold;',
        );

        Object.entries(cats).forEach(([name, data]) => {
          if (Object.keys(data).length > 0) {
            console.group(
              `%c ${name.toUpperCase()}`,
              'color: #ff00ff; text-decoration: underline;',
            );
            console.table(data);
            console.groupEnd();
          }
        });

        return params;
      } catch (e) {
        console.error('❌ Failed to parse URL:', urlString);
      }
    },

    /**
     * kit.snap(selector, filename)
     * Captures a DOM element as a PNG and downloads it.
     */
    snap: async (
      selector = '#download-div-image',
      filename = 'capture.png',
    ) => {
      // 1. Ensure html2canvas is loaded
      if (typeof html2canvas === 'undefined') {
        console.log('📦 Loading html2canvas...');
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src =
            'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // 2. Resolve target: Argument > Inspected ($0) > Default Selector
      const target =
        (typeof selector === 'string'
          ? document.querySelector(selector)
          : selector) || (typeof $0 !== 'undefined' ? $0 : null);

      if (!target) {
        console.error(
          '❌ Element not found. Provide a selector or select an element in the inspector.',
        );
        return;
      }

      // 3. Render and Download
      try {
        console.log('📸 Capturing...');
        const canvas = await html2canvas(target, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
        });

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename.endsWith('.png')
          ? filename
          : `${filename}.png`;
        link.click();

        console.log(`✅ ${filename} downloaded!`);
      } catch (err) {
        console.error('❌ Snap failed:', err);
      }
    },

    watch: (el = $0) => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => console.log('👀 Change detected:', m));
      });
      observer.observe(el, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      console.log('Watching element for changes...');
    },

    // --- 2. DATA & FORMATTING ---
    // Copy any object to clipboard as formatted JSON
    copy: (obj) => {
      copy(JSON.stringify(obj, null, 2));
      console.log('📋 Copied to clipboard!');
    },

    // Get a summary of all keys and types in an object
    shape: (obj) =>
      console.table(
        Object.keys(obj).map((k) => ({
          key: k,
          type: typeof obj[k],
          value: obj[k],
        })),
      ),

    tableToJSON: (selector = 'table') => {
      const table =
        $0 instanceof HTMLTableElement ? $0 : document.querySelector(selector);
      if (!table) {
        console.error(
          '❌ Table element not found. Provide a selector or select a table in the inspector.',
        );
        return;
      }

      const headers = kit.all('th', table).map((th) => th.innerText.trim());
      const rows = kit
        .all('tr', table)
        .slice(1)
        .map((tr) => {
          const cells = kit.all('td', tr);
          return Object.fromEntries(
            headers.map((h, i) => [h, cells[i]?.innerText.trim()]),
          );
        });
      console.table(rows);
      return rows;
    },

    // --- 3. NETWORK & ASYNC ---
    // Promisified timeout
    sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
    wait: (ms) => new Promise((res) => setTimeout(res, ms)),

    slow: (ms = 3000) => {
      const oldFetch = kit._oldFetch;
      window.fetch = async (...args) => {
        await new Promise((r) => setTimeout(r, ms));
        return oldFetch(...args);
      };
      console.log(`🐌 Latency of ${ms}ms injected into fetch().`);
    },

    // Fetch and return JSON (shorthand)
    fetchJSON: (url) => fetch(url).then((r) => r.json()),

    // --- 4. CSS & UI ---
    // Outline every element on the page (The "What is overlapping?" fix)
    outlines: () => {
      const s = document.createElement('style');
      s.innerHTML = '* { outline: 1px solid red !important; }';
      document.head.appendChild(s);
    },

    // Make every element on the page editable
    edit: () =>
      (document.designMode = document.designMode === 'off' ? 'on' : 'off'),

    // Get current scroll percentage
    scrollPercentage: () =>
      (window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight)) *
      100,

    // --- 5. PERFORMANCE & EVENTS ---
    // Measure how long a function takes to run
    time: (fn, ...args) => {
      console.time('Timer');
      const res = fn(...args);
      console.timeEnd('Timer');
      return res;
    },

    // List all event listeners on an element (Chrome/Firefox only)
    listeners: (el) => getEventListeners(el),

    // Log every event of a certain type on the document
    logEvents: (type) => monitorEvents(document, type),

    // --- 6. STATE & STORAGE ---
    clearCookies: () => {
      if (confirm('Are you sure you want to clear all cookies?') === false) {
        return;
      }

      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
    },

    // Clear everything: Cookies, LocalStorage, SessionStorage
    nukeAll: () => {
      if (confirm('Are you sure you want to clear all data?') === false) {
        return;
      }

      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
    },

    // Get LocalStorage size in KB
    storageSize: () => {
      let _lsTotal = 0,
        _xLen,
        _x;
      for (_x in localStorage) {
        if (!localStorage.hasOwnProperty(_x)) continue;
        _xLen = (localStorage[_x].length + _x.length) * 2;
        _lsTotal += _xLen;
      }
      return (_lsTotal / 1024).toFixed(2) + ' KB';
    },

    // --- 7. UTILS ---
    // Generate a random UUID
    uuid: () => crypto.randomUUID(),

    // Quick Debounce
    debounce: (fn, ms = 300) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(null, args), ms);
      };
    },

    /**
     * kit.recordTab(durationMs, filename)
     * Records the screen/tab for a set duration and downloads a WebM.
     */
    recordTab: async (durationMs = 5000, filename = 'recording.webm') => {
      try {
        console.log('🎬 Select the source to record...');

        // 1. Request screen capture stream
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: false, // Set to true if you want to capture system audio
        });

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm; codecs=vp9',
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

        // 2. Start recording
        mediaRecorder.start();
        console.log(`🔴 Recording for ${durationMs / 1000}s...`);

        // 3. Stop after duration
        await new Promise((resolve) => setTimeout(resolve, durationMs));

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename.endsWith('.webm')
            ? filename
            : `${filename}.webm`;
          a.click();

          // Cleanup
          stream.getTracks().forEach((track) => track.stop());
          URL.revokeObjectURL(url);
          console.log('✅ Recording saved!');
        };

        mediaRecorder.stop();
      } catch (err) {
        console.error('❌ Recording failed:', err);
      }
    },

    /**
     * kit.recordingStart(withAudio, delayInSeconds)
     * Starts a screen recording manually. Pass true to include microphone audio.
     */
    recordingStart: async (withAudio = false, delayInSeconds = 3) => {
      try {
        console.log('🎬 Select source...');

        // 1. Get Video (Screen/Tab)
        const videoStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true, // Captures system audio if the user checks the box
        });

        let combinedStream = videoStream;

        // 2. Get Audio (Microphone) if requested
        if (withAudio) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            // Merge the video track and the mic audio track
            combinedStream = new MediaStream([
              ...videoStream.getVideoTracks(),
              ...audioStream.getAudioTracks(),
            ]);
            console.log('🎤 Microphone attached.');
          } catch (micErr) {
            console.warn('⚠️ Mic access denied, recording video only.');
          }
        }

        console.log(
          `%c ⏱️ Starting in ${seconds}s...`,
          'color: #ff0000; font-size: 14px;',
        );
        for (let i = seconds; i > 0; i--) {
          console.log(`%c ${i}`, 'color: #000000; font-size: 20px;');
          await new Promise((r) => setTimeout(r, 1000));
        }

        const mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: 'video/webm; codecs=vp9',
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

        kit._recorder = mediaRecorder;
        kit._stream = combinedStream;

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rec-${new Date().getTime()}.webm`;
          a.click();

          // Stop all tracks (turns off the "recording" icons in browser)
          combinedStream.getTracks().forEach((track) => track.stop());
          URL.revokeObjectURL(url);
          console.log('✅ Recording saved!');
        };

        mediaRecorder.start();
        console.log(
          `🔴 Recording ${withAudio ? 'with audio ' : ''}started. Run 'kit.recordingStop()' to finish.`,
        );
      } catch (err) {
        console.error('❌ Failed to start recording:', err);
      }
    },

    /**
     * kit.recordingStop()
     * Stops the active recording and triggers download.
     */
    recordingStop: () => {
      if (!kit._recorder || kit._recorder.state === 'inactive') {
        console.warn('⚠️ No active recording found.');
        return;
      }

      kit._recorder.stop();
      kit._stream.getTracks().forEach((track) => track.stop());

      // Clear references
      kit._recorder = null;
      kit._stream = null;
      console.log('⏹️ Recording stopped.');
    },

    // Get all unique values in an array
    unique: (arr) => [...new Set(arr)],

    // Sort an array of objects by a specific key
    sort: (arr, key) => [...arr].sort((a, b) => (a[key] > b[key] ? 1 : -1)),

    // --- HELP ---
    help: () => {
      console.log(
        '%c DevKit Available Functions:',
        'color: #0000ff; font-weight: bold;',
      );
      Object.keys(kit)
        .filter((k) => k !== 'help' && typeof kit[k] === 'function')
        .forEach((k) => console.log(` - kit.${k}()`));
    },
  };

  return kit;
})();

kit.help();
