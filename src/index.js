import * as maplibregl from "maplibre-gl";
import * as pmtiles from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import './style.css';

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles",protocol.tile);

//データの数値ごとの色分け基準を指定
const colorset = ['#d7191c', '#e54f35', '#f3854e', '#fdb56a', '#fed38c', '#fff0ae', '#f0f9ba', '#d1ecb0', '#b3e0a6', '#88c4aa', '#5aa4b2', '#2b83ba'];
const groupset = [100,200,300,400,500,600,700,800,900,1000,1100,1200];

const categoryNames = ["2021年駅1日あたり乗降客数（A）","駅500m圏推定商業店舗数（B）","商業充実度スコア（B/A）"];
const flagNames01 = ["num_passengers","num_shops","num_score"];
const flagNames02 = ["rank_passengers","rank_shops","rank_score"];
let target_category = 0;

const categoryLength = categoryNames.length;
for (let i = 0; i < categoryLength; i++) {
    const selectCategory = document.getElementById('category-id');
    const optionName = document.createElement('option');
    optionName.value = categoryNames[i];
    optionName.textContent = categoryNames[i];
    selectCategory.appendChild(optionName);
}

const selected_category = document.querySelector('.category-select');

//マップの説明欄の記述内容
const descriptionBox = document.getElementById('description');
let descriptionContent = '';
descriptionContent += '<h1>東京近郊駅の利用客数・店舗数マップ</h1>';
descriptionContent += '<p class="tipstyle01">東京駅から100km圏内にある各鉄道駅の乗降客数（人/日）と、各駅から500m圏内の推定商業店舗数、および「店舗数/乗降客数」で算出した商業充実度スコアを表示するマップです。</p>';
descriptionContent += '<p class="tipstyle01">鉄道路線・駅は<a href="https://maps.gsi.go.jp/development/ichiran.html">国土数値情報</a>の駅グループ情報を参照し、モノレールなどの新交通システム駅は除外しています。</p>';
descriptionContent += '<p class="tipstyle01">商業充実度は「駅の利用者数に対して店舗数が多い」ほど高スコアになります。ただし、駅の乗降客数が1000人以下または推定商業店舗数が2店以下の駅は計算対象外としています。</p>';
descriptionContent += '<p class="tipstyle01">ご意見等は<a href="https://form.run/@party--1681740493" target="_blank">問い合わせフォーム（外部サービス）</a>からお知らせください。</p>';
descriptionContent += '<hr><p class="remarks">地図描画ライブラリ：<a href="https://maplibre.org/">MapLibre</a><br>ベースマップ：<a href="https://www.openstreetmap.org/">OpenStreetMap</a> | <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a><br>駅別乗降客数 : <a href="https://nlftp.mlit.go.jp/ksj/">国土数値情報（駅別乗降客数 2021年データ）</a><br>推定店舗数 : <a href="https://developer.yahoo.co.jp/sitemap/">Webサービス by Yahoo! JAPAN（2024年5月取得情報を参考値として利用）</a><br>View code on <a href="https://github.com/sanskruthiya/RailwayStationTokyo100kmScore">Github</a></p>';
descriptionContent += '<hr><p class="tipstyle01">凡例（順位による12段階色分け）</p>';
descriptionBox.innerHTML = descriptionContent;

//マップの説明欄に凡例を追加
for (let i = 0; i < 12; i++) {
    const startRank = (i === 0 ? 1 : groupset[i-1]+1);
    const endRank = (i < 11 ? groupset[i] : 1510);

    const legendItem = document.createElement('div');
    legendItem.classList.add('legend-item');

    const colorBox = document.createElement('div');
    colorBox.classList.add('legend-color');
    colorBox.style.backgroundColor = colorset[i];

    const labelText = document.createElement('span');
    labelText.textContent = `${startRank}位〜${endRank}位`;

    legendItem.appendChild(colorBox);
    legendItem.appendChild(labelText);
    descriptionBox.appendChild(legendItem);
}

//データのリスト表示機能の設定
const listingPOl = document.getElementById('feature-list');
function renderListings(features) {
    const listingBox = document.createElement('p');
    listingPOl.innerHTML = '';
    
    const existingToggleButton = document.getElementById('toggle-list-button'); //This returns null on the first render.
    if (existingToggleButton) {existingToggleButton.remove();}
    
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '▲ 広げる';
    toggleButton.id = 'toggle-list-button';
    toggleButton.classList.add('toggle-button');
    if (listingPOl.classList.contains('large-screen')) {
        toggleButton.textContent = '▼ 戻す';
    } else {
        toggleButton.textContent = '▲ 広げる';
    }
    
    toggleButton.addEventListener('click', function() {
        listingPOl.classList.toggle('large-screen');
        if (listingPOl.classList.contains('large-screen')) {
            toggleButton.textContent = '▼ 戻す';
        } else {
            toggleButton.textContent = '▲ 広げる';
        }
    });
    listingPOl.insertBefore(toggleButton, listingPOl.firstChild);

    //対象データの情報をテーブル形式で格納
    if (features.length) { 
        listingBox.textContent = 'マップ中央付近の駅を順位が高い順に表示';
        listingPOl.appendChild(listingBox);
        const table = document.createElement('table');
        table.classList.add('listing-table');

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = ['駅名', '乗降客数', '周辺店舗数', '商業充実度'];
        headers.forEach(headerText => {
            const header = document.createElement('th');
            header.textContent = headerText;
            headerRow.appendChild(header);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const feature of features) {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = feature.properties.name;
            row.appendChild(nameCell);

            const passengersCell = document.createElement('td');
            passengersCell.textContent = Number(feature.properties.num_passengers).toLocaleString() + '人 (' + (feature.properties.rank_passengers) + '位)';
            row.appendChild(passengersCell);

            const shopsCell = document.createElement('td');
            shopsCell.textContent = Number(feature.properties.num_shops).toLocaleString() + ' (' + (feature.properties.rank_shops) + '位)';
            row.appendChild(shopsCell);

            const scoreCell = document.createElement('td');
            scoreCell.textContent = (feature.properties.num_score > 0 ? Number(feature.properties.num_score).toLocaleString()+' ('+(feature.properties.rank_score) +'位)': '- (対象外)' );
            row.appendChild(scoreCell);

            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        listingPOl.appendChild(table);
    } else {
        const listingBox = document.createElement('p');
        listingBox.textContent = 'マップ中央付近にデータがありません。';
        listingPOl.appendChild(listingBox);
    }
}

const init_coord = [139.77, 35.68];
const init_zoom = 9.5;
const init_bearing = 0;
const init_pitch = 0;

const map = new maplibregl.Map({
    container: 'map',
    style: {"version":8,"name":"blank","center":[0,0],"zoom":1,"bearing":0,"pitch":0,"sources":{"plain":{"type":"vector","url":""}},"sprite":"","glyphs":location.href+"app/fonts/{fontstack}/{range}.pbf","layers":[{"id":"background","type":"background","paint":{"background-color":"#f0f8ff"}}],"id":"blank"},
    center: init_coord,
    interactive: true,
    zoom: init_zoom,
    minZoom: 5,
    maxZoom: 21,
    maxBounds: [[110.0000, 25.0000],[170.0000, 50.0000]],
    bearing: init_bearing,
    pitch: init_pitch,
    attributionControl: true,
    hash: false
});

map.on('load', () => {
    map.addSource('basemap_GSIblank', {
        'type': 'raster',
        'tiles': ['https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png'],
        'tileSize': 256,
        'minzoom': 5,
        'maxzoom': 14,
        'attribution': '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
    });
    map.addSource('basemap_OSM', {
        'type': 'raster',
        'tiles': ['https://tile.openstreetmap.jp/styles/osm-bright-ja/{z}/{x}/{y}.png'],
        'tileSize': 256,
        'minzoom': 5,
        'maxzoom': 20,
        'attribution': '<a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    });
    map.addSource('st_point', {
        'type': 'vector',
        'url': 'pmtiles://app/data/RsGcP2021Tky100km1k2_point.pmtiles',
        "minzoom": 5,
        "maxzoom": 10,
    });
    map.addSource('st_line', {
        'type': 'vector',
        'url': 'pmtiles://app/data/RsGcP2021Tky100km1k2_line.pmtiles',
        "minzoom": 5,
        "maxzoom": 10,
    });
    
    map.addLayer({
        'id': 'basemap-GSIblank',
        'type': 'raster',
        'source': 'basemap_GSIblank',
        'minzoom': 5,
        'maxzoom': 12,
        'layout': {
            'visibility': 'visible',
        },
    });
    map.addLayer({
        'id': 'basemap-OSM',
        'type': 'raster',
        'source': 'basemap_OSM',
        'minzoom': 12,
        'layout': {
            'visibility': 'visible',
        },
    });
    map.addLayer({
        'id': 'railway1',
        'type': 'line',
        'source':'st_line',
        'source-layer':'lineR',
        'layout': {
            'visibility': 'visible',
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': '#1e90ff',
            'line-opacity': 1,
            'line-blur': 2,
            'line-width': 4
        }
    });
    map.addLayer({
        'id': 'railway2',
        'type': 'line',
        'source':'st_line',
        'source-layer':'lineR',
        'layout': {
            'visibility': 'visible',
            'line-join': 'bevel',
            'line-cap': 'butt'
        },
        'paint': {
            'line-color': '#fff',
            'line-opacity': 1,
            'line-width': 1
        }
    });
    map.addLayer({
        'id': 'poi_point',
        'type': 'circle',
        'source':'st_point',
        'source-layer':'pointS',
        'minzoom': 5,
        'layout': {
            'visibility': 'visible',
            'circle-sort-key':["to-number", ['get',flagNames01[target_category]]],
        },
        'paint': {
            'circle-color':['step',['get',flagNames02[target_category]],colorset[0],groupset[0],colorset[1],groupset[1],colorset[2],groupset[2],colorset[3],groupset[3],colorset[4],groupset[4],colorset[5],groupset[5],colorset[6],groupset[6],colorset[7],groupset[7],colorset[8],groupset[8],colorset[9],groupset[9],colorset[10],groupset[10],colorset[11]],
            'circle-stroke-color':'#1e90ff',
            'circle-stroke-width':1,
            'circle-opacity': 0.8,
            'circle-radius': ['interpolate',['linear'],['zoom'],5,1,20,20]
        }
    });
    map.addLayer({
        'id': 'poi_text',
        'type': 'symbol',
        'source':'st_point',
        'source-layer':'pointS',
        'minzoom': 12,
        'layout': {
            'text-field':['get',flagNames01[target_category]],
            'text-offset': [0,0],
            'text-anchor': 'center',
            'icon-image':'',
            'symbol-sort-key':["to-number", ['get',flagNames01[target_category]]],
            'symbol-z-order': "viewport-y",
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-size': ['interpolate',['linear'],['zoom'],8,12,12,14,20,18],
            'text-font': ["NotoSans-SemiBold"]
        },
        'paint': {'text-color': '#fff','text-halo-color': '#333','text-halo-width': 1}
    });
    map.addLayer({
        'id': 'area_whole',
        'type': 'line',
        'source':'st_line',
        'source-layer':'circleA',
        'minzoom': 5,
        'layout': {
            'visibility': 'visible',
        },
        'paint': {
            'line-color': '#1e90ff',
            'line-opacity': 0.8,
            'line-width': 1.5
        }
    });
    map.addLayer({
        'id': 'area_st',
        'type': 'line',
        'source':'st_line',
        'source-layer':'circleS',
        'minzoom': 12,
        'layout': {
            'visibility': 'visible',
        },
        'paint': {
            'line-color': '#1e90ff',
            'line-opacity': 0.5,
            'line-blur': 0.8,
            'line-width': 2
        }
    });
    map.addLayer({
        'id': 'area_text',
        'type': 'symbol',
        'source':'st_line',
        'source-layer':'circleS',
        'minzoom': 12,
        'layout': {
            'text-field': ["format",['get', 'name'], "駅500m圏"],
            'text-offset': [0,0],
            'text-anchor': 'top',
            'text-size': 14,
            'icon-image':'',
            'symbol-spacing': 210,
            'symbol-placement':'line',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-rotation-alignment': 'map',
            'text-font': ["NotoSans-SemiBold"]
        },
        'paint': {'text-color': '#777','text-halo-color': '#fff','text-halo-width': 1}
    });

    function generateList () {
        const center = map.getCenter();
        const point = map.project(center);
        const bbox = [
            [point.x - 20, point.y - 20],
            [point.x + 20, point.y + 20]
        ];
        const extentPOI = map.queryRenderedFeatures(bbox, { layers: ['poi_point']});
        renderListings(extentPOI);
    }

    map.on('moveend', generateList);
    
    selected_category.addEventListener('change', () => {
        target_category = selected_category.selectedIndex;
        map.setPaintProperty('poi_point', 'circle-color', ['step',['get',flagNames02[target_category]],colorset[0],groupset[0],colorset[1],groupset[1],colorset[2],groupset[2],colorset[3],groupset[3],colorset[4],groupset[4],colorset[5],groupset[5],colorset[6],groupset[6],colorset[7],groupset[7],colorset[8],groupset[8],colorset[9],groupset[9],colorset[10],groupset[10],colorset[11]]);
        map.setLayoutProperty('poi_point', 'circle-sort-key', ["to-number", ['get',flagNames01[target_category]]])
        map.setLayoutProperty('poi_text', 'text-field', ['get',flagNames01[target_category]]);
        generateList();
    });

    map.on('click', 'poi_point', function (e){
        map.panTo(e.lngLat,{duration:1000});
    
        let popupContent;
        const feat = map.queryRenderedFeatures(e.point, { layers: ['poi_point']})[0];
        popupContent = 
        '<h3>'+(feat.properties.name)+'駅</h3>'+
        '<table class="tablestyle02">'+
        '<tr><td>乗降客数（順位）</td><td>'+Number(feat.properties.num_passengers).toLocaleString()+'人 ('+(feat.properties.rank_passengers)+'位)</td></tr>'+
        '<tr><td>推定店舗数（順位）</td><td>'+Number(feat.properties.num_shops).toLocaleString()+'店 ('+(feat.properties.rank_shops)+'位)</td></tr>'+
        '<tr><td>商業充実度（順位）</td><td>'+(feat.properties.num_score > 0 ? Number(feat.properties.num_score).toLocaleString()+' ('+(feat.properties.rank_score) +'位)': '- (対象外)' ) + '</td></tr>'+
        '</table>'+
        '<p class="remarks"><a href="https://www.google.com/maps/search/?api=1&query=' + feat.geometry["coordinates"][1].toFixed(5)+',' + feat.geometry["coordinates"][0].toFixed(5) + '&zoom=18" target="_blank" rel="noopener">Google Mapで見る</a></p>';
        
        new maplibregl.Popup({closeButton:true, focusAfterOpen:false, className:'t-popup', maxWidth:'360px', anchor:'bottom'})
        .setLngLat(e.lngLat)
        .setHTML(popupContent)
        .addTo(map);
    });

    map.zoomTo(10, {duration: 500}); //初回表示時の視覚効果とリスト表示の実行を兼ねて少しだけマップを自動ズームする
});

document.getElementById('b_description').style.backgroundColor = "#fff";
document.getElementById('b_description').style.color = "#333";
document.getElementById('description').style.display ="none";

document.getElementById('b_location').style.backgroundColor = "#fff";
document.getElementById('b_location').style.color = "#333";

document.getElementById('b_description').addEventListener('click', function () {
    const visibility = document.getElementById('description');
    if (visibility.style.display == 'block') {
        visibility.style.display = 'none';
        this.style.backgroundColor = "#fff";
        this.style.color = "#555"
    }
    else {
        visibility.style.display = 'block';
        this.style.backgroundColor = "#2c7fb8";
        this.style.color = "#fff";
    }
});

const geocoderApi = {
    forwardGeocode: async (config) => {
        const features = [];
        try {
            const request =
        `https://nominatim.openstreetmap.org/search?q=${
            config.query
        }&format=geojson&polygon_geojson=1&addressdetails=1`;
            const response = await fetch(request);
            const geojson = await response.json();
            for (const feature of geojson.features) {
                const center = [
                    feature.bbox[0] +
                (feature.bbox[2] - feature.bbox[0]) / 2,
                    feature.bbox[1] +
                (feature.bbox[3] - feature.bbox[1]) / 2
                ];
                const point = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: center
                    },
                    place_name: feature.properties.display_name,
                    properties: feature.properties,
                    text: feature.properties.display_name,
                    place_type: ['place'],
                    center
                };
                features.push(point);
            }
        } catch (e) {
            console.error(`Failed to forwardGeocode with error: ${e}`);
        }

        return {
            features
        };
    }
};

const geocoder = new MaplibreGeocoder(geocoderApi, {
        maplibregl,
        zoom: 10,
        placeholder: '場所を検索',
        collapsed: true,
        //bbox:[122.94, 24.04, 153.99, 45.56],
        countries:'ja',
        language:'ja'
    }
);
map.addControl(geocoder, 'top-right');

const loc_options = {
    enableHighAccuracy: false,
    timeout: 5000,
    maximumAge: 0
};

document.getElementById('icon-loader').style.display = 'none';

let popup_loc = new maplibregl.Popup({anchor:"top", focusAfterOpen:false});
let marker_loc = new maplibregl.Marker({draggable: true});
let flag_loc = 0;

document.getElementById('b_location').addEventListener('click', function () {
    this.setAttribute("disabled", true);
    if (flag_loc > 0) {
        marker_loc.remove();
        popup_loc.remove();
        this.style.backgroundColor = "#fff";
        this.style.color = "#333";
        flag_loc = 0;
        this.removeAttribute("disabled");
    }
    else {
        document.getElementById('icon-loader').style.display = 'block';
        this.style.backgroundColor = "#87cefa";
        this.style.color = "#fff";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                marker_loc.remove();
                popup_loc.remove();

                document.getElementById('icon-loader').style.display = 'none';
                this.style.backgroundColor = "#2c7fb8";
                this.style.color = "#fff";

                let c_lat = position.coords.latitude;
                let c_lng = position.coords.longitude;
            
                map.jumpTo({
                    center: [c_lng, c_lat],
                    zoom: init_zoom + 1,
                });

                const popupContent = "現在地";;

                popup_loc.setLngLat([c_lng, c_lat]).setHTML(popupContent).addTo(map);
                marker_loc.setLngLat([c_lng, c_lat]).addTo(map);
                flag_loc = 1;
                this.removeAttribute("disabled");
            },
            (error) => {
                popup_loc.remove();
                document.getElementById('icon-loader').style.display = 'none';
                this.style.backgroundColor = "#999";
                this.style.color = "#fff";
                console.warn(`ERROR(${error.code}): ${error.message}`)
                map.flyTo({
                    center: init_coord,
                    zoom: init_zoom,
                    speed: 1,
                });
                popup_loc.setLngLat(init_coord).setHTML('現在地が取得できませんでした').addTo(map);
                flag_loc = 2;
                this.removeAttribute("disabled");
            },
            loc_options
        );
    }
});
