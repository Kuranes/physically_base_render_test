Physically Base Render : Equation playground
============================================

## [The online playground](http://kuranes.github.io/physically_base_render_test/)

### Done:
- tweak roughness dielectric diffuse/alberdo specular
- Select equation term by term
- Select model and textures
- tweak color, light and gamma
- shader reload
- enable/disable textures (diffuse/roughness/metallic/hdrenv)


### Todo: 
- edit and see shader
- edit and see term with equation
- save & share materials using values from http://seblagarde.wordpress.com/2012/04/30/dontnod-specular-and-glossiness-chart/
- more lights
- IBL & area lights
- tiled/forward/deferred

## Thanks & Sources

### Alexandre Pestana for the idea and dx11 implementations of pbr_viewer
- http://www.alexandre-pestana.com/tweaking-the-cook-torrance-brdf/
- 
### The Book
- http://www.pbrt.org/ (+ [related paper]( http://www.pbrt.org/papers.php))

### PBR Equation details
- http://graphicrants.blogspot.ca/2013/08/specular-brdf-reference.html
- http://simonstechblog.blogspot.fr/2011/12/microfacet-brdf.html

### PBR Siggraph Courses
- http://blog.selfshadow.com/publications/s2013-shading-course/ 
- http://blog.selfshadow.com/publications/s2012-shading-course/
- http://renderwonk.com/publications/s2010-color-course/
- http://renderwonk.com/publications/s2010-shading-course/

### PBR reading lists
- http://lousodrome.net/blog/light/2011/12/27/readings-on-physically-based-rendering/
- http://interplayoflight.wordpress.com/2013/12/30/readings-on-physically-based-rendering/

### Related Blog posts on PBR & CG
- http://seblagarde.wordpress.com/2012/04/30/dontnod-specular-and-glossiness-chart/
- http://blog.selfshadow.com/2011/07/22/specular-showdown/
- http://renderwonk.com/blog/index.php/archive/distribution-based-brdfs/
- http://www.thetenthplanet.de/archives/255
- http://c0de517e.blogspot.fr/2013/12/notes-on-epics-area-lights.html
- http://mmikkelsen3d.blogspot.fr/2011/12/so-finally-no-tangents-bump-demo-is-up.html
- http://colinbarrebrisebois.com/category/reoriented-normal-mapping/
- http://aras-p.info/blog/2012/03/27/tiled-forward-shading-links/
- http://lousodrome.net/blog/light/2013/05/26/gamma-correct-and-hdr-rendering-in-a-32-bits-buffer/
- http://filmicgames.com/archives/581
- http://mycodefit.com/?p=52
- http://www.realtimerendering.com/blog/deferred-lighting-approaches
- http://pixelstoomany.wordpress.com/2008/07/05/another-day-another-hdr-rendering-trick-and-some-hope-for-the-future/
- http://gameangst.com/?p=441
- http://graphicsrunner.blogspot.co.uk/search/label/Dual-Paraboloid
- http://fgiesen.wordpress.com/category/graphics-pipeline/
- http://the-witness.net/news/2010/09/hemicube-rendering-and-integration/
- http://www.realtimerendering.com/index.html
- https://github.com/YuqinShao/Tile_Based_WebGL_DeferredShader
- http://codeflow.org/entries/2012/aug/25/webgl-deferred-irradiance-volumes/
- http://alteredqualia.com/xg/examples/deferred_tubelights.html
- http://diaryofagraphicsprogrammer.blogspot.fr/2013/09/call-for-new-post-processing-pipeline.html
 

### Brdf Explorer
- [webgl](http://patapom.com/topics/WebGL/BRDF/ + same author wiki http://wiki.nuaj.net/index.php?title=BRDF)
- [disney] (http://www.disneyanimation.com/technology/brdf.html) + [instructions](http://www.forceflow.be/2012/08/20/compiling-the-wdas-brdf-explorer/)
- [bv](http://www.graphics.stanford.edu/~smr/brdf/bv/)

### Papers list..
- [Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs](http://hal.inria.fr/docs/00/96/78/44/PDF/RR-8468.pdf)
-[An Overview of BRDF Models](http://digibug.ugr.es/bitstream/10481/19751/1/rmontes_LSI-2012-001TR.pdf)
- [Rational BRDF](http://hal.inria.fr/docs/00/67/88/85/PDF/main_tvcg.pdf)
- [Distribution-based BRDFs](http://www.cs.utah.edu/~premoze/dbrdf/)
- [Fast, Arbitrary BRDF Shading for Low-Frequency Lighting Using Spherical Harmonics](http://www.mpi-inf.mpg.de/~jnkautz/projects/shbrdf/shbrdfRW02.pdf)
-[Accurate fitting of measured reflectances using a Shifted Gamma micro-facet distribution](http://hal.inria.fr/hal-00702304)

### Origins
- [The scattering of electromagnetic waves from rough surfaces](http://books.google.fr/books/about/The_scattering_of_electromagnetic_waves.html?id=QBEIAQAAIAAJ&redir_esc=y)
- [Models of Light Reflection for Computer Synthesized Pictures](http://research.microsoft.com/pubs/73852/p192-blinn.pdf)
- [An Inexpensive BRDF Model for Physically-based Rendering](http://www.cs.virginia.edu/~jdl/bib/appearance/analytic%20models/schlick94b.pdf)
- [Bidirectional Reflection Functions from Surface Bump Maps](http://www.anyhere.com/gward/pickup/p273-cabral.pdf)
- [Geometrical considerations and nomenclature for reflectance](http://www.graphics.stanford.edu/courses/cs448-05-winter/papers/nicodemus-brdf-nist.pdf)
- [Making shaders more physically plausible](http://www.tricity.wsu.edu/~bobl/personal/mypubs/1993_plausible.pdf)

### open source research-oriented rendering system 
- https://github.com/mmp/pbrt-v2 (from the book)
- https://www.mitsuba-renderer.org/
