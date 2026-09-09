# Optional licensed room artwork

Purchased room backgrounds are omitted. The shipped Families collection has `rooms: []`, so the full photograph gallery renders without a mockup dependency.

If a room provider expressly permits the intended website display and redistribution, an authorized maintainer can add appropriately licensed web images and room entries. For local-only experiments, use the ignored `public/local-licensed-rooms/` folder and keep any private configuration outside tracked gallery data. The current runtime does not automatically load `local-rooms.json`; a maintainer must explicitly wire a local-only configuration without committing private paths or unlicensed images.

The supported room data shape is:

```json
{
  "id": "licensed-room-example",
  "title": "Illustrative room",
  "alt": "A licensed room preview showing photographic artwork",
  "src": "/local-licensed-rooms/example.jpg",
  "width": 2000,
  "height": 1500,
  "art": [{"imageId": "families-01", "quad": [[100,100],[900,100],[900,650],[100,650]]}]
}
```

The example coordinates are illustrative, not measurements. Use actual image dimensions and measured corners, contain the complete photograph, and identify the result as a mockup. Do not represent it as a photographed client installation. Before public use, confirm license scope and remove any source/capture metadata from exported copies while preserving originals.
