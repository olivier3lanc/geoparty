'use strict';
const gp = {
    defaults: {
        storyUrl: './story.json',
        themeUrl: './theme.json',
        sequential: true,
        leaflet: {
            circles: {
                default: {
                    radius: 2,
                    dashArray: '4',
                    className: 'gp-circle'
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
    theme: null,
    circles: {},
    lastUserLat: 0,
    lastUserLng: 0,
    spotRunSuccess: [],
    isObject: function(data) {
        return typeof data === 'object' && !Array.isArray(data) && data !== null
    },
    isArray: function(data) {
        return Array.isArray(data);
    },
    localStorageAvailable: function() {
        let storage;
        try {
            storage = window['localStorage'];
            const x = "__storage_test__";
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return (
                e instanceof DOMException &&
                // everything except Firefox
                (e.code === 22 ||
                    // Firefox
                    e.code === 1014 ||
                    // test name field too, because code might not be present
                    // everything except Firefox
                    e.name === "QuotaExceededError" ||
                    // Firefox
                    e.name === "NS_ERROR_DOM_QUOTA_REACHED") &&
                // acknowledge QuotaExceededError only if there's something already stored
                storage &&
                storage.length !== 0
            );
        }
    },
    // Get local storage data from identifier
    getLocalStorage: function(identifier) {
        if (gp.localStorageAvailable() && typeof identifier == 'string') {
            return JSON.parse(localStorage.getItem(identifier));
        }
    },
    // Store on localStorage
    saveLocalStorage: function({identifier, backup}) {
        if (gp.localStorageAvailable()
            && typeof identifier == 'string'
            && typeof backup == 'object') {
            // console.log('save', identifier, JSON.stringify(backup));
            localStorage.setItem(identifier, JSON.stringify(backup));
        }
    },
    // Clear localStorage
    clearLocalStorage: function(identifier) {
        if (gp.localStorageAvailable()) {
            localStorage.removeItem(identifier);
        }
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
    getStory: async function(url) {
        try {
            const response = await fetch(url || gp.defaults.storyUrl);
            gp.story = await response.json();
        } catch (error) {
            console.log(error);
        }
    },
    getTheme: async function(url) {
        try {
            const response = await fetch(url || gp.defaults.themeUrl);
            gp.theme = await response.json();
        } catch (error) {
            // console.log(error);
            gp.theme = {};
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
            console.log('spot click', evt)
        },
        _circleClick: function(evt) {
            console.log('circle click', evt)
        },
        _mapClick: function(evt) {
            console.log('map click', evt);
            gp.lastUserLat = evt.latlng.lat;
            gp.lastUserLng = evt.latlng.lng;
            gp.updateStory()
        }
    },
    spotIsOk: function(spot) {
        let result = true;
        if (typeof spot == 'object') {
            if (gp.isArray(spot)
                || typeof spot.lat != 'number'
                || typeof spot.lng != 'number') {
                result = false;
            }
        } else {
            result = false;
        }
        return result;
    },
    renderStorySpots: function() {
        if (gp.isArray(gp.story.spots)) {
            gp.story.spots.forEach(function(spot, spotIndex) {
                const spotId = spot.id || `spot_${spotIndex + 1}`;
                if (gp.spotIsOk(spot) && gp.circles[spotId] === undefined) {
                    const iconOptions = { id: spotId };
                    Object.keys(gp.defaults.leaflet.circles.default).forEach(function(defaultParam) {
                        iconOptions[defaultParam] = gp.defaults.leaflet.circles.default[defaultParam];
                    });
                    if (typeof spot.styleName == 'string') {
                        if (gp.isObject(gp.theme.spots[spot.styleName])) {
                            Object.keys(gp.theme.spots[spot.styleName]).forEach(function(customParam) {
                                iconOptions[customParam] = gp.theme.spots[spot.styleName][customParam];
                            });
                        }
                    }
                    console.log(spotId,iconOptions)
                    gp.circles[spotId] = L.circle([spot.lat, spot.lng], iconOptions).addTo(gp.map);
                    gp.circles[spotId].on('click', gp.handlers._circleClick);
                }
            });
        }
    },
    init: async function(options) {
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
                style: options?.leaflet?.style || gp.defaults.leaflet.style
            }).addTo(gp.map);

            await gp.getStory(options?.storyUrl);
            await gp.getTheme(options?.themeUrl);
            gp.renderStorySpots();
            gp.fitMap();

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
                    gp.fitMap();
                }
            }).addTo(gp.map);
            gp.map.on('click', gp.handlers._mapClick);
            // console.log(gp.story)
        }
    },
    fitMap: function() {
        if (gp.map !== null) {
            let spotsCoordsToDisplay = [];
            Object.keys(gp.circles).forEach(function(spotId) {
                const latLng = gp.circles[spotId].getLatLng();
                spotsCoordsToDisplay.push([latLng.lat, latLng.lng]);
            });
            if (gp.lastUserLat !== 0 && gp.lastUserLng !== 0) spotsCoordsToDisplay.push([gp.lastUserLat, gp.lastUserLng]);
            gp.map.fitBounds(spotsCoordsToDisplay, {padding: [20, 20]});
        }
    },
    spotRun: function(spotId) {
        if (typeof spotId == 'string') {
            if (gp.circles[spotId] !== undefined) {
                alert(spotId);
                gp.circles[spotId].remove();
                gp.spotRunSuccess.push(spotId);
            }
        }
    },
    updateStory: function() {
        Object.keys(gp.circles).forEach(function(spotId) {
            const   spotLatLng = gp.circles[spotId].getLatLng(),
                    spotLat = spotLatLng.lat,
                    spotLng = spotLatLng.lng,
                    distance = gp.getHaversineDistance(spotLat, spotLng, gp.lastUserLat, gp.lastUserLng);
            console.log(spotId, distance);
            if (distance <= gp.circles[spotId].options.radius && !gp.spotRunSuccess.includes(spotId)) gp.spotRun(spotId)
        });
    }
}

