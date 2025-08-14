

const gp = {
    parameters: {
        storyUrl: './story.json',
        leaflet: {
            icons: {
                default: {
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                }
            },
            style: 'https://openmaptiles.geo.data.gouv.fr/styles/osm-bright/style.json',
            // style: 'https://tiles.openfreemap.org/styles/liberty',
            attribution: '<a href="https://www.etalab.gouv.fr/" target="_blank">© Etalab</a> <a href="https://www.openmaptiles.org/" target="_blank">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© Contributeurs OpenStreetMap</a>'
        }
    },
    map: null,
    mapgl: null,
    story: null,
    spots: {},
    lastUserLat: 0,
    lastUserLng: 0,
    isArray: function(data) {
        let response = false;
        if (typeof data == 'object') {
            if (Object.prototype.toString.call(data) === '[object Array]') {
                response = true;
            }
        };
        return response;
    },
    /**
     * GET HAVERSINE DISTANCE
     * The haversine formula determines the great-circle distance
     * between two points on a sphere given their longitudes and latitudes.
     * @param {Number} lat1 - Float - Latitude point 1 value
     * @param {Number} lon1 - Float - Longitude point 1 value
     * @param {Number} lat2 - Float - Latitude point 2 value
     * @param {Number} lng2 - Float - Longitude point 2 value
     * @return {Number} meters
     */
    // https://stackoverflow.com/a/60465578
    getHaversineDistance: function (lat1, lon1, lat2, lon2) {
        const radlat1 = Math.PI * lat1 / 180;
        const radlat2 = Math.PI * lat2 / 180;
        const theta = lon1 - lon2;
        const radtheta = Math.PI * theta / 180;
        let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        dist = dist * 1.609344 * 1000; // meters
        return dist;
    },
    getStory: async function() {
        try {
            const response = await fetch(gp.parameters.storyUrl);
            gp.story = await response.json();
        } catch (error) {
            console.log(error);
        }
    },
    getUserLocation: async function() {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        return {
            long: pos.coords.longitude,
            lat: pos.coords.latitude
        };
    },
    handlers: {
        _spotClick: function(evt) {
            console.log(evt)
        },
        _mapClick: function(evt) {
            console.log(evt)
        }
    },
    spotIsOk: function(spot) {
        let result = true;
        if (typeof spot == 'object') {
            if (gp.isArray(spot)
                || typeof spot.id != 'string'
                || typeof spot.lat != 'number'
                || typeof spot.lng != 'number') {
                result = false;
            }
        } else {
            result = false;
        }
        return result;
    },
    renderSpots: function() {
        if (gp.isArray(gp.story.spots)) {
            gp.story.spots.forEach(function(spot) {
                if (gp.spotIsOk(spot)) {
                    let iconOptions = gp.parameters.leaflet.icons.default;
                    if (typeof spot.icon == 'object') iconOptions = spot.icon;
                    gp.spots[spot.id] = L.marker([spot.lat, spot.lng], {
                        icon: L.icon(iconOptions),
                        custom: spot.custom
                    });
                    gp.spots[spot.id].on('click', gp.handlers._spotClick);
                    gp.spots[spot.id].addTo(gp.map);
                }
            });
        }
    },
    init: async function() {
        // const userLocation = await gp.getUserLocation();
        // console.log(userLocation);
        if (typeof L == 'object'
            && gp.map === null
            && gp.mapgl === null) {
            gp.map = L.map('map', {
                center: [45, 2],
                zoom: 15,
                zoomControl: false
            });
            gp.mapgl = L.maplibreGL({
                style: gp.parameters.leaflet.style,
                attribution: gp.parameters.leaflet.attribution
            }).addTo(gp.map);

            gp.simpleLocate = new L.Control.SimpleLocate({
                position: "topleft",
                className: "button-locate",
                afterClick: (result) => {
                    // Do something after the button is clicked.
                },
                afterMarkerAdd: (event) => {
                    // Do something after the marker (displaying the device's location and orientation) is added.
                    // console.log("kj")
                    // console.log(event)
                },
                afterDeviceMove: (event) => {
                    // Do something after the device moves.
                    gp.lastUserLat = event.lat;
                    gp.lastUserLng = event.lng;
                    gp.updateStory();
                }
            }).addTo(gp.map);
            gp.map.on('click', gp.handlers._mapClick);
            await gp.getStory();
            // console.log(gp.story)
            gp.renderSpots();
            gp.fitMap();
        }
    },
    fitMap: function() {
        if (gp.map !== null) {
            let spotsCoordsToDisplay = [];
            Object.keys(gp.spots).forEach(function(spotId) {
                const latLng = gp.spots[spotId].getLatLng();
                spotsCoordsToDisplay.push([latLng.lat, latLng.lng]);
            });
            gp.map.fitBounds(spotsCoordsToDisplay, {padding: [20, 20]});
        }
    },
    updateStory: function() {
        Object.keys(gp.spots).forEach(function(spotId) {
            const   spotLatLng = gp.spots[spotId].getLatLng(),
                    spotLat = spotLatLng.lat,
                    spotLng = spotLatLng.lng,
                    distance = gp.getHaversineDistance(spotLat, spotLng, gp.lastUserLat, gp.lastUserLng);
            console.log(spotId, distance);
        })
    }
}
gp.init();

