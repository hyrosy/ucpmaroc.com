import{j as t}from"./index-BRMoMsJu.js";import{p as c}from"./purify.es-CGs5VtEq.js";const h=({data:e,isPreview:r})=>{const a=e.code||"",n=e.allowJavascript||!1,o=e.useTailwind||!1,s=e.useFullPage||!1?{width:"100vw",height:"100vh",position:"relative",left:"50%",transform:"translateX(-50%)"}:{width:"100%",height:`${e.iframeHeight||600}px`};if(!a&&r)return t.jsxs("div",{className:"w-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20 text-muted-foreground text-sm",children:[t.jsx("p",{className:"font-semibold",children:"Custom HTML Block"}),t.jsx("p",{className:"text-xs opacity-70",children:"Paste your code in the sidebar to preview."})]});if(!a)return null;if(n){const l=`${`
      <style>body { margin: 0; overflow-x: hidden; }</style>
      ${o?'<script src="https://cdn.tailwindcss.com"><\/script>':""}
      ${o?"<script>tailwind.config = { corePlugins: { preflight: false } }<\/script>":""}
      <script>
        // --- BFCACHE RELOAD FIX ---
        // Some browsers (like Safari on iOS) use a back-forward cache that can
        // cause the iframe content to disappear on back navigation. This forces a reload.
        window.addEventListener('pageshow', function(event) {
          if (event.persisted) { window.location.reload(); }
        });
        
        // --- EXTERNAL LINK FIX ---
        // Prevents "api.whatsapp.com is blocked" by forcing external links to open in a new tab 
        // if they don't explicitly have a target and aren't simple anchor links.
        document.addEventListener('click', function(e) {
          const a = e.target.closest('a');
          if (a && a.getAttribute('href')) {
            const href = a.getAttribute('href');
            if (!href.startsWith('#') && !a.target) {
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
            }
          }
        });

        window.UCP = {
          addToCart: function(productId, quantity = 1) {
            window.parent.postMessage({
              type: 'UCP_ADD_TO_CART',
              payload: { productId, quantity }
            }, '*');
          },
          checkout: function(planId) {
            window.parent.postMessage({
              type: 'UCP_CHECKOUT',
              payload: { planId }
            }, '*');
          }
        };
      <\/script>
    `}
${a}`;return t.jsx("iframe",{sandbox:"allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox",srcDoc:l,className:"border-0 bg-transparent",style:s,title:"Custom Sandboxed Block",loading:"lazy"})}const i=`
    <style>body { margin: 0; overflow-x: hidden; }</style>
    <script>
      window.addEventListener('pageshow', function(event) { if (event.persisted) window.location.reload(); });
      document.addEventListener('click', function(e) {
        const a = e.target.closest('a');
        if (a && a.getAttribute('href')) {
          const href = a.getAttribute('href');
          if (!href.startsWith('#') && !a.target) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
        }
      });
    <\/script>
    ${c.sanitize(a,{ADD_TAGS:["style","iframe"],ADD_ATTR:["allow","allowfullscreen","frameborder","scrolling","style"],USE_PROFILES:{html:!0,svg:!0,mathMl:!0}})}
  `;return t.jsx("iframe",{sandbox:"allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox",srcDoc:i,className:"border-0 bg-transparent",style:s,title:"Custom Sandboxed Block (CSS Only)",loading:"lazy"})};export{h as default};
