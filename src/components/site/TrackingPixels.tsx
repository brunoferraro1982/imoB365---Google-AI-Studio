import { useEffect } from "react";

type Pixels = {
  ga4_id?: string | null;
  gtm_id?: string | null;
  fb_pixel_id?: string | null;
  google_ads_id?: string | null;
  hotjar_id?: string | null;
  head_custom_html?: string | null;
};

const MARKER = "data-tracking-pixel";

function inject(id: string, html: string) {
  if (document.querySelector(`script[${MARKER}="${id}"]`)) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  Array.from(wrapper.childNodes).forEach((node) => {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      el.setAttribute(MARKER, id);
      document.head.appendChild(el);
    }
  });
}

function injectScript(id: string, src: string, async = true) {
  if (document.querySelector(`script[${MARKER}="${id}"]`)) return;
  const s = document.createElement("script");
  s.async = async;
  s.src = src;
  s.setAttribute(MARKER, id);
  document.head.appendChild(s);
}

export function TrackingPixels({ pixels }: { pixels: Pixels | null | undefined }) {
  useEffect(() => {
    if (!pixels) return;
    const {
      ga4_id, gtm_id, fb_pixel_id, google_ads_id, hotjar_id, head_custom_html,
    } = pixels;

    if (ga4_id) {
      injectScript(`ga4-src-${ga4_id}`, `https://www.googletagmanager.com/gtag/js?id=${ga4_id}`);
      inject(`ga4-init-${ga4_id}`, `<script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${ga4_id}');
      </script>`);
    }

    if (google_ads_id) {
      injectScript(`ads-src-${google_ads_id}`, `https://www.googletagmanager.com/gtag/js?id=${google_ads_id}`);
      inject(`ads-init-${google_ads_id}`, `<script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${google_ads_id}');
      </script>`);
    }

    if (gtm_id) {
      inject(`gtm-${gtm_id}`, `<script>
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
        var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
        j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtm_id}');
      </script>`);
    }

    if (fb_pixel_id) {
      inject(`fb-${fb_pixel_id}`, `<script>
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${fb_pixel_id}'); fbq('track', 'PageView');
      </script>`);
    }

    if (hotjar_id) {
      inject(`hj-${hotjar_id}`, `<script>
        (function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:${Number(hotjar_id)},hjsv:6};a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
      </script>`);
    }

    if (head_custom_html && head_custom_html.trim()) {
      inject(`custom-head`, head_custom_html);
    }
  }, [pixels]);

  return null;
}