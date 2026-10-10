var f={},b=($,h,y)=>(f.__chunk_80860=(w,p,c)=>{"use strict";c.d(p,{_g:()=>g});var d=c(28118);function g(n,s){if(s==="robots"){let t="";for(let l of Array.isArray(n.rules)?n.rules:[n.rules]){for(let a of(0,d.mY)(l.userAgent||["*"]))t+=`User-Agent: ${a}
`;if(l.allow)for(let a of(0,d.mY)(l.allow))t+=`Allow: ${a}
`;if(l.disallow)for(let a of(0,d.mY)(l.disallow))t+=`Disallow: ${a}
`;l.crawlDelay&&(t+=`Crawl-delay: ${l.crawlDelay}
`),t+=`
`}return n.host&&(t+=`Host: ${n.host}
`),n.sitemap&&(0,d.mY)(n.sitemap).forEach(l=>{t+=`Sitemap: ${l}
`}),t}return s==="sitemap"?function(t){let l=t.some(i=>Object.keys(i.alternates??{}).length>0),a=t.some(i=>{var r;return!!((r=i.images)!=null&&r.length)}),_=t.some(i=>{var r;return!!((r=i.videos)!=null&&r.length)}),o="";for(let i of(o+=`<?xml version="1.0" encoding="UTF-8"?>
`,o+='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',a&&(o+=' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'),_&&(o+=' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"'),l?o+=` xmlns:xhtml="http://www.w3.org/1999/xhtml">
`:o+=`>
`,t)){var v,m,u;o+=`<url>
`,o+=`<loc>${i.url}</loc>
`;let r=(v=i.alternates)==null?void 0:v.languages;if(r&&Object.keys(r).length)for(let e in r)o+=`<xhtml:link rel="alternate" hreflang="${e}" href="${r[e]}" />
`;if((m=i.images)!=null&&m.length)for(let e of i.images)o+=`<image:image>
<image:loc>${e}</image:loc>
</image:image>
`;if((u=i.videos)!=null&&u.length)for(let e of i.videos)o+=["<video:video>",`<video:title>${e.title}</video:title>`,`<video:thumbnail_loc>${e.thumbnail_loc}</video:thumbnail_loc>`,`<video:description>${e.description}</video:description>`,e.content_loc&&`<video:content_loc>${e.content_loc}</video:content_loc>`,e.player_loc&&`<video:player_loc>${e.player_loc}</video:player_loc>`,e.duration&&`<video:duration>${e.duration}</video:duration>`,e.view_count&&`<video:view_count>${e.view_count}</video:view_count>`,e.tag&&`<video:tag>${e.tag}</video:tag>`,e.rating&&`<video:rating>${e.rating}</video:rating>`,e.expiration_date&&`<video:expiration_date>${e.expiration_date}</video:expiration_date>`,e.publication_date&&`<video:publication_date>${e.publication_date}</video:publication_date>`,e.family_friendly&&`<video:family_friendly>${e.family_friendly}</video:family_friendly>`,e.requires_subscription&&`<video:requires_subscription>${e.requires_subscription}</video:requires_subscription>`,e.live&&`<video:live>${e.live}</video:live>`,e.restriction&&`<video:restriction relationship="${e.restriction.relationship}">${e.restriction.content}</video:restriction>`,e.platform&&`<video:platform relationship="${e.platform.relationship}">${e.platform.content}</video:platform>`,e.uploader&&`<video:uploader${e.uploader.info&&` info="${e.uploader.info}"`}>${e.uploader.content}</video:uploader>`,`</video:video>
`].filter(Boolean).join(`
`);if(i.lastModified){let e=i.lastModified instanceof Date?i.lastModified.toISOString():i.lastModified;o+=`<lastmod>${e}</lastmod>
`}i.changeFrequency&&(o+=`<changefreq>${i.changeFrequency}</changefreq>
`),typeof i.priority=="number"&&(o+=`<priority>${i.priority}</priority>
`),o+=`</url>
`}return o+`</urlset>
`}(n):s==="manifest"?JSON.stringify(n):""}},f);export{b as __getNamedExports};
