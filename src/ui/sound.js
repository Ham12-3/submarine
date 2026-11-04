/**
 * Procedural ambience (no audio files): a low hull rumble made from filtered brown noise
 * and a sonar ping with a decaying echo every few seconds.
 */
export function initSound(button) {
  let ctx = null;
  let master = null;
  let delay = null;
  let pingTimer = null;
  let on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // brown noise rumble
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    lp.Q.value = 0.8;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 70;
    lfo.connect(lfoGain).connect(lp.frequency);
    const rumble = ctx.createGain();
    rumble.gain.value = 0.55;
    noise.connect(lp).connect(rumble).connect(master);
    noise.start();
    lfo.start();

    // echo for the ping
    delay = ctx.createDelay(2);
    delay.delayTime.value = 0.46;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const fbLp = ctx.createBiquadFilter();
    fbLp.type = 'lowpass';
    fbLp.frequency.value = 1600;
    delay.connect(fbLp).connect(fb).connect(delay);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    delay.connect(wet).connect(master);
  }

  function ping() {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, t);
    osc.frequency.exponentialRampToValueAtTime(1120, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    osc.connect(g);
    g.connect(master);
    g.connect(delay);
    osc.start(t);
    osc.stop(t + 1.8);
  }

  async function set(next) {
    on = next;
    button.setAttribute('aria-pressed', String(on));
    if (on) {
      if (!ctx) build();
      await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
      ping();
      pingTimer = setInterval(ping, 5600);
    } else if (ctx) {
      clearInterval(pingTimer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    }
  }

  button.addEventListener('click', () => set(!on));
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
}
