const previews = {
  "07f59839133492f58ad8884a.jpg": {
    "file": "07f59839133492f58ad8884a.jpg",
    "width": 2000,
    "height": 2800
  },
  "08bfbe519671b2a3ec187588.jpg": {
    "file": "08bfbe519671b2a3ec187588.jpg",
    "width": 2800,
    "height": 1867
  },
  "0d730119329ad4799756e2bd.jpg": {
    "file": "0d730119329ad4799756e2bd.jpg",
    "width": 2800,
    "height": 1866
  },
  "1e7f972e651c8e41c91168b6.jpg": {
    "file": "1e7f972e651c8e41c91168b6.jpg",
    "width": 1440,
    "height": 960
  },
  "335e2ea0847bd07fec38d935.jpg": {
    "file": "335e2ea0847bd07fec38d935.jpg",
    "width": 3200,
    "height": 2133
  },
  "34b32ab8408f756277f44d70.jpg": {
    "file": "34b32ab8408f756277f44d70.jpg",
    "width": 1600,
    "height": 2400
  },
  "363dc893eff2ab2c7ff0724e.jpg": {
    "file": "363dc893eff2ab2c7ff0724e.jpg",
    "width": 3840,
    "height": 2560
  },
  "459d0941c6b06f06023017bd.jpg": {
    "file": "459d0941c6b06f06023017bd.jpg",
    "width": 3840,
    "height": 1283
  },
  "6c2bcb595c230d3249389708.jpg": {
    "file": "6c2bcb595c230d3249389708.jpg",
    "width": 3200,
    "height": 2133
  },
  "aa854f83427a78814a8c9330.jpg": {
    "file": "aa854f83427a78814a8c9330.jpg",
    "width": 3200,
    "height": 2133
  },
  "c4236e1c13029c8bfe85db2d.jpg": {
    "file": "c4236e1c13029c8bfe85db2d.jpg",
    "width": 2133,
    "height": 3200
  },
  "c4a641f3b456ab59149913ea.jpg": {
    "file": "c4a641f3b456ab59149913ea.jpg",
    "width": 1440,
    "height": 960
  },
  "c6231e82c5d10dbda7f1220d.jpg": {
    "file": "c6231e82c5d10dbda7f1220d.jpg",
    "width": 1440,
    "height": 960
  },
  "underpier-photograph.jpg": {
    "file": "underpier-photograph.jpg",
    "width": 4000,
    "height": 2667
  }
};

export const mobileScene = matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 600px)').matches;
export function sceneImage(source, preview = mobileScene) {
  const record = previews[new URL(source, location.href).pathname.split('/').pop()];
  return preview && record ? (record.url || new URL('./media/scene-mobile/' + record.file, import.meta.url).href) : source;
}
export function sceneSourceSize(source) {
  return previews[new URL(source, location.href).pathname.split('/').pop()] || null;
}
