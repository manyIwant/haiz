import * as THREE from 'three';

/**
 * Toggleable Engineering Debug Visualizer (OFF by default).
 * Shows:
 *  - Left/Right Foot contact discs (color-coded by PLANTED/LIFT/SWING)
 *  - Center-of-Mass plumb sphere + ground projection
 *  - 5-stage Gaze -> Head -> Chest -> Pelvis turn-cascade directional arrows
 *  - Live foot slide & penetration waveform chart in the inspector
 */
export class LabDebugOverlay {
  constructor(scene, chartCanvas = null) {
    this.scene = scene;
    this.chartCanvas = chartCanvas;
    this.ctx = chartCanvas ? chartCanvas.getContext('2d') : null;
    this.visible = false;

    this.group = new THREE.Group();
    this.group.name = 'HAIZ_Lab_DebugOverlay';
    this.group.visible = false;
    scene.add(this.group);

    const discGeo = new THREE.RingGeometry(0.055, 0.085, 24);
    discGeo.rotateX(-Math.PI / 2);
    this.leftDisc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide }));
    this.rightDisc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide }));
    this.comDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false })
    );
    this.comGround = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 })
    );

    this.pelvisArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.55, 0x3b82f6, 0.12, 0.07);
    this.gazeArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.65, 0xec4899, 0.12, 0.07);

    this.group.add(this.leftDisc, this.rightDisc, this.comDot, this.comGround, this.pelvisArrow, this.gazeArrow);

    this.historyL = [];
    this.historyR = [];
    this.maxSamples = 140;
    this.tmpV = new THREE.Vector3();
    this.tmpDir = new THREE.Vector3();
  }

  setVisible(flag) {
    this.visible = Boolean(flag);
    this.group.visible = this.visible;
  }

  update(agent) {
    if (!agent || !this.visible) return;
    const diag = agent.getDiagnosticState();
    const t = agent.telemetry.lastMetrics;
    const feet = agent.human.locomotion.feet;

    const phaseColor = (ph) => (ph === 'PLANTED' ? 0x22c55e : ph === 'SWING' ? 0x38bdf8 : 0xf59e0b);
    this.leftDisc.material.color.setHex(phaseColor(t.leftPhase));
    this.rightDisc.material.color.setHex(phaseColor(t.rightPhase));
    this.leftDisc.position.set(feet.left.position.x, t.leftGroundY + 0.008, feet.left.position.z);
    this.rightDisc.position.set(feet.right.position.x, t.rightGroundY + 0.008, feet.right.position.z);

    if (agent.bones.hips) {
      agent.bones.hips.getWorldPosition(this.tmpV);
      this.comDot.position.copy(this.tmpV);
      const avgY = 0.5 * (t.leftGroundY + t.rightGroundY);
      this.comGround.position.set(this.tmpV.x, avgY + 0.006, this.tmpV.z);

      const hRad = agent.human.heading;
      this.pelvisArrow.position.set(this.tmpV.x, this.tmpV.y, this.tmpV.z);
      this.pelvisArrow.setDirection(this.tmpDir.set(Math.sin(hRad), 0, Math.cos(hRad)));

      const gRad = agent.turnCascade.gazeTargetHeading;
      this.gazeArrow.position.set(this.tmpV.x, this.tmpV.y + 0.62, this.tmpV.z);
      this.gazeArrow.setDirection(this.tmpDir.set(Math.sin(gRad), 0, Math.cos(gRad)));
    }

    this.historyL.push(t.leftPhase === 'PLANTED' ? t.leftSlideMmS : 0);
    this.historyR.push(t.rightPhase === 'PLANTED' ? t.rightSlideMmS : 0);
    if (this.historyL.length > this.maxSamples) this.historyL.shift();
    if (this.historyR.length > this.maxSamples) this.historyR.shift();

    this._drawChart();
    return diag;
  }

  _drawChart() {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.chartCanvas.width;
    const h = this.chartCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // 50 mm/s baseline threshold
    const yThresh = h - Math.min(h - 6, (50 / 160) * h);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, yThresh);
    ctx.lineTo(w, yThresh);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawLine = (arr, color) => {
      if (arr.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const x = (i / (this.maxSamples - 1)) * w;
        const y = h - Math.min(h - 4, (arr[i] / 160) * h) - 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawLine(this.historyL, '#34d399');
    drawLine(this.historyR, '#60a5fa');
  }
}
