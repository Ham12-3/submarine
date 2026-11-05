import * as THREE from 'three';

/**
 * The giant wordmark that stands on the horizon in the opening shot.
 * Drawn to a canvas once the display font has loaded, then shown as a plane in the scene
 * so the submarine can sit in front of it and the swell can lap at its base.
 */
export class TitleSign {
  constructor(text = 'ABYSSAL') {
    this.text = text;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 4096;
    this.canvas.height = 1024;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      color: new THREE.Color(0.72, 0.69, 0.63),
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), this.material);
    this.mesh.renderOrder = 2;
    this.draw();
  }

  draw() {
    const g = this.canvas.getContext('2d');
    const { width: W, height: H } = this.canvas;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    let size = 900;
    g.font = `300 ${size}px "Clash Display", "DM Sans", sans-serif`;
    const w = g.measureText(this.text).width;
    size *= Math.min(1, (W * 0.96) / w);
    g.font = `300 ${size}px "Clash Display", "DM Sans", sans-serif`;
    g.fillText(this.text, W / 2, H * 0.86);
    this.texture.needsUpdate = true;
  }

  /** Place the sign so it spans `widthFrac` of the view at `distance` from the camera. */
  layout(camera, distance, widthFrac) {
    const vH = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
    const vW = vH * camera.aspect;
    const w = Math.min(vW * widthFrac, vH * 3.4);
    this.mesh.scale.set(w, w, 1);
  }
}
