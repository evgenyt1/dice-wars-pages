# Dicefront icon choices

The user selected **2. Duel** on 7 September 2026.

1. Classic cube — violet resin cube with an F face.
2. Duel — overlapping violet and lime dice.
3. Territory — a blue die over three hex territories.
4. Minimal — a bold violet five-pip die.

`options.png` shows home-screen-sized artwork and small previews. The numbered
SVGs are the editable sources; corresponding PNGs are 512×512 previews. Artwork
is full bleed and opaque. Rounded masks in the contact sheet are previews only;
the phone applies its own icon mask.

The selected SVG supplies the SVG favicon, 32×32 PNG favicon, 180×180 Apple
touch icon and 192×192 / 512×512 manifest icons. A separate maskable 512px icon
scales the artwork to 80% on its opaque background so the dice fit the safe area.
Icon URLs in app/layout.tsx and the manifest use `duel-1` for cache refresh.
The home-screen title, application name, manifest name and short_name remain
exactly `Dicefront`.

The header and loader now use `public/game-assets/dicefront-duel.svg` in both
themes. This and the SVG/PNG favicons omit the full-canvas background rectangle;
favicon URLs use `duel-transparent-2`. Home-screen artwork retains its opaque
background and maskable padding.
