let camera, scene, renderer, controls;
let objects = [];
let targets = { table: [], sphere: [], helix: [], grid: [] };

function handleGoogleLogin(response) {
  const tokenPayload = parseJwt(response.credential);
  console.log("Logged in user:", tokenPayload.name);

  document.getElementById('login-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');

  fetchGoogleSheetData();
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

function init3DScene(data) {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 3200;

  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.minDistance = 200;
  controls.maxDistance = 6000;
  controls.addEventListener('change', render);

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    const element = document.createElement('div');
    element.className = 'element';
    
    let netWorthNum = parseNetWorth(item.netWorth);
    element.setAttribute('data-networth', netWorthNum);

    // Requirement 5: Color background based on Net Worth (Red < $100K, Orange > $100K, Green > $200K)
    if (netWorthNum < 100000) {
      element.style.backgroundColor = 'rgba(239, 48, 34, 0.85)'; // Red
    } else if (netWorthNum <= 200000) {
      element.style.backgroundColor = 'rgba(255, 165, 0, 0.85)'; // Orange
    } else {
      element.style.backgroundColor = 'rgba(58, 164, 72, 0.85)'; // Green
    }

    // Top-left: Country
    const countryEl = document.createElement('div');
    countryEl.className = 'card-country';
    countryEl.textContent = item.country;
    element.appendChild(countryEl);

    // Top-right: Age
    const ageEl = document.createElement('div');
    ageEl.className = 'card-age';
    ageEl.textContent = item.age;
    element.appendChild(ageEl);

    // Center: Profile Photo
    const img = document.createElement('img');
    img.className = 'image';
    img.src = item.photo;
    element.appendChild(img);

    // Bottom: Name, Interest
    const details = document.createElement('div');
    details.className = 'details';
    details.innerHTML = `<strong>${item.name}</strong><br>${item.interest}`;
    element.appendChild(details);

    const objectCSS = new THREE.CSS3DObject(element);
    objectCSS.position.x = Math.random() * 4000 - 2000;
    objectCSS.position.y = Math.random() * 4000 - 2000;
    objectCSS.position.z = Math.random() * 4000 - 2000;
    scene.add(objectCSS);

    // Click-to-Zoom / Focus feature
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      focusOnCard(objectCSS);
    });

    objects.push(objectCSS);
  }

  setupTableLayout();
  setupSphereLayout();
  setupHelixLayout();
  setupGridLayout();

  document.getElementById('table-btn').addEventListener('click', () => transformLayout(targets.table, 2000));
  document.getElementById('sphere-btn').addEventListener('click', () => transformLayout(targets.sphere, 2000));
  document.getElementById('helix-btn').addEventListener('click', () => transformLayout(targets.helix, 2000));
  document.getElementById('grid-btn').addEventListener('click', () => transformLayout(targets.grid, 2000));
  document.getElementById('reset-btn').addEventListener('click', resetCameraView);

  setupLegendFilter();

  transformLayout(targets.table, 2000);
  animate();
}

function parseNetWorth(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseFloat(val.replace(/[^0-9.-]+/g,"")) || 0;
}

// 1. Table Layout: 20 columns x 10 rows
function setupTableLayout() {
  for (let i = 0; i < objects.length; i++) {
    const object = new THREE.Object3D();
    object.position.x = ((i % 20) * 140) - 1330;
    object.position.y = (- (Math.floor(i / 20) * 180)) + 900;
    object.position.z = 0;
    targets.table.push(object);
  }
}

// 2. Sphere Layout (Radius 1400 to prevent overlap)
function setupSphereLayout() {
  const vector = new THREE.Vector3();
  for (let i = 0; i < objects.length; i++) {
    const phi = Math.acos(-1 + (2 * i) / objects.length);
    const theta = Math.sqrt(objects.length * Math.PI) * phi;
    const object = new THREE.Object3D();
    object.position.setFromSphericalCoords(1400, phi, theta);
    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);
    targets.sphere.push(object);
  }
}

// 3. Double Helix Layout (Intertwined dual-strand helical ribbons matching the reference image)
function setupHelixLayout() {
  const vector = new THREE.Vector3();
  for (let i = 0; i < objects.length; i++) {
    const strand = i % 2;
    const strandOffset = strand * Math.PI; 
    
    const theta = (Math.floor(i / 2) * 0.2) + strandOffset;
    const y = -(Math.floor(i / 2) * 12) + 600;

    const object = new THREE.Object3D();
    object.position.setFromCylindricalCoords(900, theta, y);

    vector.x = object.position.x * 2;
    vector.y = object.position.y;
    vector.z = object.position.z * 2;
    object.lookAt(vector);

    targets.helix.push(object);
  }
}

// 4. Grid Layout: 5 x 4 x 10
function setupGridLayout() {
  for (let i = 0; i < objects.length; i++) {
    const object = new THREE.Object3D();
    object.position.x = ((i % 5) * 300) - 600;
    object.position.y = (-(Math.floor(i / 5) % 4) * 230) + 350;
    object.position.z = -((Math.floor(i / 20)) * 240) + 1100;
    targets.grid.push(object);
  }
}

function focusOnCard(targetObject) {
  TWEEN.removeAll();
  const targetPos = targetObject.position.clone();
  const cameraOffset = new THREE.Vector3(0, 0, 350);
  const newCameraPos = targetPos.clone().add(cameraOffset);

  new TWEEN.Tween(camera.position)
    .to({ x: newCameraPos.x, y: newCameraPos.y, z: newCameraPos.z }, 1500)
    .easing(TWEEN.Easing.Exponential.InOut)
    .start();

  new TWEEN.Tween(controls.target)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1500)
    .easing(TWEEN.Easing.Exponential.InOut)
    .onUpdate(() => controls.update())
    .start();
}

function resetCameraView() {
  TWEEN.removeAll();
  new TWEEN.Tween(camera.position)
    .to({ x: 0, y: 0, z: 3200 }, 1500)
    .easing(TWEEN.Easing.Exponential.InOut)
    .start();

  new TWEEN.Tween(controls.target)
    .to({ x: 0, y: 0, z: 0 }, 1500)
    .easing(TWEEN.Easing.Exponential.InOut)
    .onUpdate(() => controls.update())
    .start();
}

let filterState = 0; 
function setupLegendFilter() {
  const legendBar = document.querySelector('.gradient-bar');
  if (!legendBar) return;
  legendBar.style.cursor = 'pointer';

  legendBar.addEventListener('click', (event) => {
    const rect = legendBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const ratio = clickX / rect.width;

    let targetTier = 1;
    if (ratio < 0.33) targetTier = 1;
    else if (ratio <= 0.66) targetTier = 2;
    else targetTier = 3;

    if (window.lastClickedTier === targetTier) {
      filterState = 0;
      window.lastClickedTier = null;
    } else {
      window.lastClickedTier = targetTier;
      filterState = targetTier;
    }

    objects.forEach(obj => {
      const el = obj.element;
      const nw = parseFloat(el.getAttribute('data-networth'));
      
      let show = true;
      if (filterState === 1 && nw >= 100000) show = false;
      if (filterState === 2 && (nw < 100000 || nw > 200000)) show = false;
      if (filterState === 3 && nw <= 200000) show = false;

      if (filterState === 0 || show) {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      } else {
        el.style.opacity = '0.12';
        el.style.pointerEvents = 'none';
      }
    });
  });
}

function transformLayout(targetArray, duration) {
  TWEEN.removeAll();
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const target = targetArray[i];

    new TWEEN.Tween(object.position)
      .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }

  new TWEEN.Tween(this)
    .to({}, duration * 2)
    .onUpdate(render)
    .start();
}

function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();
}

function render() {
  renderer.render(scene, camera);
}

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

// Fetch data from public Google Sheet endpoint with loading & error handling
async function fetchGoogleSheetData() {
  const sheetId = '1NHzfM-otEkIHVdenAQcqdSDWKuTJkKcYh98GckaffjA';
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;

  showLoadingState("Loading personnel records from Google Sheets...");

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const text = await res.text();
    if (!text.includes('google.visualization.Query.setResponse')) {
      throw new Error("Invalid response format from Google Sheets. Ensure the sheet is public or shared with lisa@kasatria.com.");
    }

    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;
    
    if (!rows || rows.length === 0) {
      throw new Error("The Google Sheet contains no records or rows are empty.");
    }

    const dataList = rows.map((row) => {
      return {
        name: row.c[0] ? row.c[0].v : 'Unknown',
        photo: row.c[1] ? row.c[1].v : 'https://via.placeholder.com/80',
        age: row.c[2] ? row.c[2].v : 'N/A',
        country: row.c[3] ? row.c[3].v : 'N/A',
        interest: row.c[4] ? row.c[4].v : 'General',
        netWorth: row.c[5] ? row.c[5].v : 0
      };
    });

    hideLoadingState();
    init3DScene(dataList);
  } catch (error) {
    console.error("Error loading Google Sheet data:", error);
    showErrorState(`Failed to load Google Sheet data: ${error.message}. Please check sheet sharing permissions.`);
  }
}

function showLoadingState(message) {
  let loader = document.getElementById('loading-overlay');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'loading-overlay';
    loader.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:9999;font-family:Arial;font-size:16px;";
    document.body.appendChild(loader);
  }
  loader.innerHTML = `<div style="border: 4px solid #f3f3f3; border-top: 4px solid #00ffcc; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 15px;"></div><div>${message}</div>`;
  
  if (!document.getElementById('spin-style')) {
    const style = document.createElement('style');
    style.id = 'spin-style';
    style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
}

function hideLoadingState() {
  const loader = document.getElementById('loading-overlay');
  if (loader) loader.remove();
}

function showErrorState(message) {
  let loader = document.getElementById('loading-overlay');
  if (loader) {
    loader.innerHTML = `<div style="color: #ff5252; font-weight: bold; margin-bottom: 10px;">Connection Error</div><div style="text-align:center; max-width:500px; padding: 0 20px;">${message}</div><button onclick="location.reload()" style="margin-top: 20px; padding: 8px 16px; background: #00ffcc; color: #000; border: none; cursor: pointer; font-weight: bold; border-radius: 4px;">Retry</button>`;
  }
}