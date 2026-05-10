// Daten für besuchte Standorte und Fotos
const visitedLocations = [
    {
        name: "Paris, Frankreich",
        position: { lat: 48.8566, lng: 2.3522 },
        photos: ["paris1.jpg", "paris2.jpg", "paris3.jpg"],
    },
    {
        name: "New York, USA",
        position: { lat: 40.7128, lng: -74.006 },
        photos: ["nyc1.jpg", "nyc2.jpg"],
    },
    {
        name: "Tokyo, Japan",
        position: { lat: 35.6895, lng: 139.6917 },
        photos: ["tokyo1.jpg"],
    },
];

// Initialisiere Cesium (kein World Terrain)
let viewer;

function initCesium() {
    // Cesium default access token is not required for basic imagery from tile servers
    Cesium.Ion.defaultAccessToken = undefined;

    viewer = new Cesium.Viewer('cesiumContainer', {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        sceneModePicker: true,
        navigationHelpButton: false,
        imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            maximumLevel: 19,
        }),
        // Use globe without terrain
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });

    viewer.scene.globe.enableLighting = true;

    loadLocations();

    // Klick-Handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function (click) {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && Cesium.defined(picked.id) && typeof picked.id.locationIndex === 'number') {
            const idx = picked.id.locationIndex;
            openAlbum(visitedLocations[idx]);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// Erzeuge einen Marker als Daten-URL (canvas) mit einem Bild im Rahmen + dreieckiger Spitze
function createMarkerDataUrl(imageUrl, size = 120) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const width = size;
            const height = size + 18; // extra für Dreieck
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Parameters for frame
            const framePadding = 6;
            const frameRadius = 10;
            const imgW = width - framePadding * 2;
            const imgH = width - framePadding * 2;

            // Draw clipped image
            ctx.save();
            // Create rounded rect clipping path for top part
            roundRect(ctx, framePadding, framePadding, imgW, imgH, frameRadius);
            ctx.clip();

            // Draw image centered and cover
            const ratio = Math.max(imgW / img.width, imgH / img.height);
            const drawW = img.width * ratio;
            const drawH = img.height * ratio;
            const dx = framePadding - (drawW - imgW) / 2;
            const dy = framePadding - (drawH - imgH) / 2;
            ctx.drawImage(img, dx, dy, drawW, drawH);
            ctx.restore();

            // Draw frame border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6;
            roundRect(ctx, framePadding, framePadding, imgW, imgH, frameRadius);
            ctx.stroke();

            // Draw drop shadow and triangle pointer
            // triangle points
            const tx = width / 2;
            const ty = height - 2;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(tx - 12, imgH + framePadding);
            ctx.lineTo(tx + 12, imgH + framePadding);
            ctx.lineTo(tx, ty);
            ctx.closePath();
            ctx.fill();

            // small border for triangle
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Export as data URL
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = function () {
            // Fallback: simple colored marker
            const canvas = document.createElement('canvas');
            const width = size;
            const height = size + 18;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#666';
            ctx.fillRect(0, 0, width, height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = imageUrl;
    });
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function loadLocations() {
    visitedLocations.forEach(async (location, idx) => {
        const cover = location.photos && location.photos.length ? location.photos[0] : null;
        const imgUrl = cover || 'placeholder.jpg';
        const dataUrl = await createMarkerDataUrl(imgUrl, 120);

        const ent = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(location.position.lng, location.position.lat),
            billboard: {
                image: dataUrl,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                // scaleByDistance can be used to make marker smaller when zoomed out
                scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.5)
            }
        });
        ent.locationIndex = idx;
    });
}

function openAlbum(location) {
    const album = document.getElementById('album');
    const photoContainer = document.getElementById('photo-container');

    document.getElementById('location-name').textContent = location.name;
    album.classList.add('active');
    photoContainer.innerHTML = '';

    location.photos.forEach((photo) => {
        const img = document.createElement('img');
        img.src = photo;
        img.alt = `Foto von ${location.name}`;
        photoContainer.appendChild(img);
    });
}

// Klick außerhalb des Albums schließt es
document.addEventListener('click', (e) => {
    const album = document.getElementById('album');
    if (!album) return;
    const withinAlbum = album.contains(e.target);
    // Wenn Klick nicht im Album und nicht auf die Cesium canvas (map), schließen
    if (!withinAlbum) {
        // allow clicking on map to open album, so don't close on map clicks
        const canvas = viewer && viewer.scene && viewer.scene.canvas;
        if (canvas && e.target === canvas) return;
        album.classList.remove('active');
    }
});

window.onload = initCesium;
