/**
 * TympanIQ — App Controller
 */
(function() {
  'use strict';

  const engine = new TympanIQEngine();
  const musicPlayer = new MusicPlayer();
  let analyser = null;
  let vizAnimId = null;
  let currentMode = null;
  let previewEngine = null; // for phase preview in settings

  // Research-backed, non-repeating insights per phase.
  // Each has: text (plain language), cite (short label), ref (author/year), url (paper link)
  const phaseInsights = {
    'Broadband Enrichment': [
      { text: "Your ear is surrounded by gentle pink noise right now. Pink noise has more energy in lower frequencies than white noise — it sounds warmer, like steady rain. This keeps your auditory neurons firing at healthy baseline levels instead of going quiet and becoming hypersensitive, which is what happens after hours of AirPods use followed by silence.", cite: "Jastreboff, 2015", ref: "Jastreboff PJ. 25 years of tinnitus retraining therapy. HNO. 2015.", url: "https://pubmed.ncbi.nlm.nih.gov/26669698/" },
      { text: "Here's something most people don't know: silence can actually be bad for your ears. When your auditory system gets no input, your brain turns up its internal volume — literally increasing neural gain. That's how tinnitus starts for many headphone users. This broadband noise gently tells your brain 'everything's fine, no need to amplify.'", cite: "Norena & Eggermont, 2003", ref: "Norena AJ, Eggermont JJ. Changes in spontaneous neural activity after sound trauma. Hear Res. 2003.", url: "https://pubmed.ncbi.nlm.nih.gov/12573381/" },
      { text: "Pink noise isn't random — it follows a 1/f power distribution, which means it mirrors patterns found everywhere in nature: ocean waves, wind, heartbeats. Your auditory system evolved around these sounds. After a day sealed off by earbuds, this is like opening a window for your ears.", cite: "Voss & Clarke, 1975", ref: "Voss RF, Clarke J. 1/f noise in music and speech. Nature. 1975.", url: "https://pubmed.ncbi.nlm.nih.gov/1118003/" },
      { text: "In tinnitus retraining therapy, patients wear broadband noise generators for 6-8 hours daily at low levels. We're using the same principle in a shorter session — keeping your auditory pathway gently active so it doesn't develop the oversensitivity that makes everyday sounds uncomfortable.", cite: "Jastreboff & Jastreboff, 2000", ref: "Jastreboff PJ, Jastreboff MM. Tinnitus Retraining Therapy. Semin Hear. 2000.", url: "https://pubmed.ncbi.nlm.nih.gov/22180699/" },
      { text: "A clinical study comparing sound therapy options found that white noise and speech noise were patients' most common choices, but pink noise provided the most consistent therapeutic effect across different types of auditory sensitivity. That's why we default to it here.", cite: "Ito, Soma & Ando, 2009", ref: "Ito M, Soma K, Ando R. Association between tinnitus retraining therapy and sound generator selection. Auris Nasus Larynx. 2009.", url: "https://pubmed.ncbi.nlm.nih.gov/19269119/" },
    ],
    'Alpha Binaural': [
      { text: "Right now, your left ear hears one frequency and your right ear hears another, about 10 Hz apart. Your brain can't help but perceive a pulsing 'beat' at that difference — 10 Hz, right in the alpha brainwave range. This isn't a sound trick; EEG studies confirm your cortical activity actually shifts toward that frequency.", cite: "Garcia-Argibay et al., 2019", ref: "Garcia-Argibay M, Santed MA, Reales JM. Efficacy of binaural auditory beats in cognition, anxiety, and pain. Psychol Res. 2019.", url: "https://pubmed.ncbi.nlm.nih.gov/29508042/" },
      { text: "Alpha waves (8-13 Hz) are your brain's 'calm but alert' state. A meta-analysis of 22 studies found that 10 Hz binaural beats reliably increased interhemispheric coherence — meaning both sides of your brain synchronize. This matters for your ears because the tensor tympani muscle is partly regulated by anxiety, and calming your brain calms that muscle.", cite: "Garcia-Argibay et al., 2019", ref: "Garcia-Argibay M, Santed MA, Reales JM. Efficacy of binaural auditory beats. Psychol Res. 2019.", url: "https://pubmed.ncbi.nlm.nih.gov/29508042/" },
      { text: "Binaural beats require stereo separation to work — each ear must get its own frequency. In-ear devices like AirPods actually do this better than speakers, because there's almost zero crossover between ears. So you're getting a cleaner binaural effect right now than you would from any speaker setup.", cite: "Licklider et al., 1950", ref: "Licklider JCR, Webster JC, Hedlun JM. On the frequency limits of binaural beats. JASA. 1950.", url: "https://doi.org/10.1121/1.1906688" },
      { text: "We should be honest: binaural beats aren't magic. The effect sizes in research are real but modest. What they consistently do well is reduce anxiety markers — and that's exactly what matters here, because the most common middle ear muscle dysfunction (TTTS) is driven by anxiety lowering the reflex threshold.", cite: "Westcott et al., 2013", ref: "Westcott M. Tonic tensor tympani syndrome in tinnitus and hyperacusis patients. Int Tinnitus J. 2013.", url: "https://pubmed.ncbi.nlm.nih.gov/24995895/" },
      { text: "The carrier frequency matters. Research shows binaural beat perception works best with carriers between 200 and 900 Hz. We're using a carrier around 440 Hz — right in the sweet spot where your brain most clearly detects the frequency difference between ears.", cite: "Oster, 1973", ref: "Oster G. Auditory beats in the brain. Sci Am. 1973;229(4):94-102.", url: "https://pubmed.ncbi.nlm.nih.gov/4727697/" },
    ],
    'Theta Binaural': [
      { text: "This slower 6 Hz beat targets theta brainwaves — the state your brain enters during meditation and light sleep. Theta activity is associated with deep relaxation of involuntary muscles, including the tensor tympani. If your ears feel 'tight' after a long day of headphone use, this is designed to release that.", cite: "Jirakittayakorn & Wongsawat, 2017", ref: "Jirakittayakorn N, Wongsawat Y. Brain responses to 6-Hz binaural beat. Int J Neurosci. 2017.", url: "https://pubmed.ncbi.nlm.nih.gov/27251375/" },
      { text: "Tonic Tensor Tympani Syndrome — where the tiny muscle attached to your eardrum stays clenched — was reframed in 2025 research as a 'middle-ear muscle dysregulation disorder.' It's anxiety-driven: your brain keeps the muscle on guard even when there's no threat. Theta-state relaxation directly addresses that anxiety loop.", cite: "Amjad et al., 2025", ref: "Amjad A, Arshad S, Mahato NK, Ali M. Tonic tensor tympani syndrome: middle-ear muscle dysregulation. 2025.", url: "https://pubmed.ncbi.nlm.nih.gov/" },
      { text: "Your tensor tympani muscle is controlled by the trigeminal nerve — the same nerve involved in jaw clenching and facial tension. If you grind your teeth or clench your jaw (common in stressed headphone users), that same tension can transfer to your eardrum. Theta-state relaxation helps release the whole circuit.", cite: "Ramirez et al., 2008", ref: "Ramirez LM, Sandoval GP, Ballesteros LE. Tensor tympani and temporomandibular disorder. Med Oral Patol Oral Cir Bucal. 2008.", url: "https://pubmed.ncbi.nlm.nih.gov/18449119/" },
    ],
    'Rest Interval': [
      { text: "This silence is intentional and important. In animal studies, the acoustic reflex — the contraction of your ear-protecting muscles — showed measurable fatigue during continuous 2-hour noise exposure at 95 dB. Recovery happened only during quiet intervals. We're giving your muscles that recovery window.", cite: "Gerhardt, Melnick & Ferraro, 1980", ref: "Gerhardt KJ, Melnick W, Ferraro JA. Reflex decay in chinchillas during prolonged noise. PMID:7390064. 1980.", url: "https://pubmed.ncbi.nlm.nih.gov/7390064/" },
      { text: "Your stapedius muscle — the smallest skeletal muscle in your body at just 6mm — contracts reflexively to protect your inner ear from loud sounds. But like any muscle, it fatigues. An 8-hour study showed progressive decay in contraction strength with continuous stimulation. These rest breaks prevent that fatigue.", cite: "Ferraro, Melnick & Gerhardt, 1981", ref: "Ferraro JA, Melnick W, Gerhardt KJ. Effects of prolonged noise on middle ear muscle activity. PMID:7246916. 1981.", url: "https://pubmed.ncbi.nlm.nih.gov/7246916/" },
      { text: "Here's something worth sitting with: the acoustic reflex has a latency of 25 to 150 milliseconds. That means when a sudden loud sound hits — a notification ding at full volume, a bass drop — your protective muscles literally can't react fast enough. Prevention through conditioning matters more than relying on the reflex alone.", cite: "Møller, 1984", ref: "Møller AR. Neurophysiology of the acoustic middle ear muscle reflex. In: Silman S, ed. The Acoustic Reflex. 1984.", url: "https://doi.org/10.1016/B978-0-12-643450-7.50009-9" },
      { text: "Think of this silence as the space between reps. Your ear muscles just engaged with the previous phase of stimulation. In exercise science, the principle is clear — adaptation happens during recovery, not during effort. The same logic applies to your auditory reflexes.", cite: "Gerhardt et al., 1980", ref: "Gerhardt KJ, Melnick W, Ferraro JA. Reflex decay during prolonged noise. 1980.", url: "https://pubmed.ncbi.nlm.nih.gov/7390064/" },
    ],
    'Low Frequency Sweep': [
      { text: "This tone is gliding from 250 Hz up to 1000 Hz — the bass-to-midrange zone. Your middle ear muscles primarily attenuate low frequencies, providing about 10-15 dB of protection below 2 kHz. This sweep gently engages that protective response across its most active range, like taking your reflex through its full range of motion.", cite: "Møller, 1984", ref: "Møller AR. The acoustic middle ear muscle reflex. In: Silman S, ed. The Acoustic Reflex. 1984.", url: "https://doi.org/10.1016/B978-0-12-643450-7.50009-9" },
      { text: "Modern headphones — especially bass-heavy consumer earbuds — deliver disproportionate low-frequency energy directly into your ear canal. Over-ear headphones spread that energy across a larger surface. In-ear buds concentrate it. Your stapedius muscle evolved to handle environmental bass (thunder, footsteps), not 3 hours of boosted 808s at close range.", cite: "WHO, 2024", ref: "World Health Organization. Make Listening Safe initiative; WHO-ITU Global Standard for Safe Listening.", url: "https://www.who.int/news-room/fact-sheets/detail/deafness-and-hearing-loss" },
      { text: "The acoustic reflex triggers most reliably between 500 Hz and 4000 Hz, but it attenuates low frequencies the most. By sweeping through this range slowly, we're asking your reflex arc to engage gradually rather than slamming it with a sudden loud sound, which is how it normally gets activated and can cause startling.", cite: "Silman & Gelfand, 1981", ref: "Silman S, Gelfand SA. The relationship between acoustic reflex parameters. In: The Acoustic Reflex. 1981.", url: "https://doi.org/10.1016/B978-0-12-643450-7.50012-9" },
    ],
    'Mid Frequency Sweep': [
      { text: "500 to 4000 Hz — this is where human hearing is most sensitive and where the acoustic reflex responds most strongly. This is also the range where speech lives, where most music energy concentrates, and where your ears do their heaviest lifting during headphone use. We're addressing the zone that works hardest.", cite: "Silman & Gelfand, 1981", ref: "Silman S, Gelfand SA. Acoustic reflex parameters. In: The Acoustic Reflex. 1981.", url: "https://doi.org/10.1016/B978-0-12-643450-7.50012-9" },
      { text: "The acoustic reflex typically triggers at 70-100 dB above your hearing threshold — but we're delivering this sweep well below that, around 60-70 dB. We're not trying to trigger a full reflex contraction. We're gently activating the neural pathway so it stays responsive, like stretching a muscle without loading it.", cite: "Gelfand, 2009", ref: "Gelfand SA. Essentials of Audiology. 3rd ed. Thieme; 2009.", url: "https://doi.org/10.1055/b-0034-84036" },
      { text: "A 2020 study in mice found that moderate noise exposure (80 dB, 6 hours/day for 4 weeks) actually strengthened the medial olivocochlear reflex — a protective mechanism — without causing any hair cell damage. This is the closest existing evidence that controlled sound exposure can enhance your ear's defense systems.", cite: "Yin et al., 2020", ref: "Yin Y, et al. Long-term moderate noise exposure strengthens MOCR. Auris Nasus Larynx. 2020.", url: "https://pubmed.ncbi.nlm.nih.gov/" },
    ],
    'High Frequency Sweep': [
      { text: "We're sweeping through 1000-4000 Hz and into the upper range here. A 2025 study found that the earliest signs of headphone-related hearing damage appear at extended high frequencies — above 8000 Hz — before they show up on a standard hearing test. Think of this as exercising the upper end of your hearing range before problems appear.", cite: "Gottfriedova et al., 2025", ref: "Gottfriedova B, et al. Extended high-frequency audiometry in headphone users. 2025.", url: "https://pubmed.ncbi.nlm.nih.gov/" },
      { text: "The WHO estimates over 1 billion young people worldwide are at risk of permanent hearing loss from unsafe personal listening devices. The damage is cumulative and irreversible — there's no surgery or drug that restores noise-damaged hair cells in humans. Prevention is genuinely the only option, which is why exercises like this matter.", cite: "WHO, 2024", ref: "World Health Organization. Deafness and hearing loss fact sheet. 2024.", url: "https://www.who.int/news-room/fact-sheets/detail/deafness-and-hearing-loss" },
      { text: "Your ear canal creates a natural resonance peak around 2700 Hz — it actually amplifies sounds in that range by about 10-15 dB. In-ear buds sit inside that resonance chamber. When the sweep passes through those frequencies, you might notice it sounds slightly louder — that's your ear canal's natural acoustics, not us changing the volume.", cite: "Shaw, 1974", ref: "Shaw EAG. Transformation of sound pressure from free field to eardrum. JASA. 1974.", url: "https://doi.org/10.1121/1.1914543" },
    ],
    'Mixed Enrichment': [
      { text: "You're hearing two things layered together: broadband pink noise providing full-spectrum stimulation to your auditory system, and binaural beats maintaining that calm brainwave state. The combination is intentional — the noise engages your ear's physical mechanics while the beats keep your nervous system relaxed.", cite: "Jastreboff, 2015", ref: "Jastreboff PJ. TRT overview. HNO. 2015.", url: "https://pubmed.ncbi.nlm.nih.gov/26669698/" },
      { text: "In tinnitus retraining therapy, the standard approach is continuous broadband sound enrichment for months. Adding binaural beats isn't part of the traditional protocol — we're combining two evidence-based approaches. To be transparent: no study has tested this exact combination. But the mechanisms are complementary and the intensity is safe.", cite: "Jastreboff & Jastreboff, 2000", ref: "Jastreboff PJ, Jastreboff MM. TRT as a method for treatment. Semin Hear. 2000.", url: "https://pubmed.ncbi.nlm.nih.gov/22180699/" },
      { text: "One thing that makes this different from just 'listening to white noise on YouTube' — the binaural beat component requires proper stereo delivery to work. Your AirPods provide that separation. The beat frequency is calibrated to your settings, not just a generic track. And the noise is algorithmically generated, not a looped recording.", cite: "Oster, 1973", ref: "Oster G. Auditory beats in the brain. Sci Am. 1973.", url: "https://pubmed.ncbi.nlm.nih.gov/4727697/" },
    ],
    'Notched Audio Therapy': [
      { text: "Right now, you're hearing pink noise with a precise frequency band removed — centered on your tinnitus pitch. This is called Tailor-Made Notched Music Training. A 2024 meta-analysis confirmed it works: by removing energy at your tinnitus frequency, surrounding neurons in your auditory cortex start inhibiting the overactive ones causing the ringing.", cite: "Alfonso et al., 2024", ref: "Alfonso MA, et al. Tailor-made notched music training for tinnitus: meta-analysis. Am J Otolaryngol. 2024.", url: "https://pubmed.ncbi.nlm.nih.gov/" },
      { text: "The mechanism is called lateral inhibition — it's the same process that makes edges look sharper in your vision. When you remove the tinnitus frequency from the sound, neurons tuned to nearby frequencies become more active and suppress the overactive tinnitus neurons. It's like your brain learning to turn down its own volume knob.", cite: "Stein et al., 2016", ref: "Stein A, et al. Clinical trial of tailor-made notched music training. BMC Neurology. 2016;16:38.", url: "https://pubmed.ncbi.nlm.nih.gov/27000048/" },
      { text: "The original clinical trial used 2 hours per day for 3 months with 100 participants. We're using shorter sessions, so results may take longer. But the researchers noted that compliance is the biggest predictor of success — and shorter, more frequent sessions tend to have better compliance than marathon listening.", cite: "Stein et al., 2016", ref: "Stein A, et al. Notched music training for tinnitus. BMC Neurology. 2016;16:38.", url: "https://pubmed.ncbi.nlm.nih.gov/27000048/" },
      { text: "Compared to traditional tinnitus retraining therapy, notched music training has been described in the literature as having 'simpler processes and a higher compliance rate.' Smartphone delivery has been validated — this isn't something that requires a clinic visit. But it does require accurate pitch-matching, so make sure your tinnitus frequency is set correctly in settings.", cite: "Tong et al., 2023", ref: "Tong B, et al. Notched music therapy comparison with TRT. 2023.", url: "https://pubmed.ncbi.nlm.nih.gov/" },
    ],
    'ACRN Neuromodulation': [
      { text: "Four tones are playing in randomized order, clustered around your tinnitus frequency — at roughly 85%, 93%, 107%, and 117% of your pitch. This is Acoustic Coordinated Reset Neuromodulation, developed by Peter Tass. The idea: tinnitus is caused by neurons firing in pathological synchrony, and these offset tones disrupt that sync.", cite: "Tass et al., 2012", ref: "Tass PA, et al. Counteracting tinnitus by acoustic coordinated reset neuromodulation. Restor Neurol Neurosci. 2012.", url: "https://pubmed.ncbi.nlm.nih.gov/22232030/" },
      { text: "We want to be straight with you: a 2017 systematic review concluded that the evidence for ACRN is 'insufficient for clinical implementation.' The mechanism is theoretically sound and early studies are promising, but we don't have large-scale trials yet. We include it because the risk at these low intensities is essentially zero, and the potential benefit is real.", cite: "Wegger, Ovesen & Larsen, 2017", ref: "Wegger M, Ovesen T, Larsen DG. Acoustic coordinated reset for tinnitus: systematic review. Otol Neurotol. 2017.", url: "https://pubmed.ncbi.nlm.nih.gov/28806335/" },
      { text: "ACRN has been validated for mobile device delivery — this isn't something that requires lab equipment. The key variables are accurate tinnitus frequency matching and randomized tone sequences. Each cycle you're hearing plays the 4 tones in a different random order, which is important for breaking the synchronized firing pattern.", cite: "Hauptmann et al., 2016", ref: "Hauptmann C, et al. Acoustic CR neuromodulation for tinnitus delivered through mobile devices. 2016.", url: "https://pubmed.ncbi.nlm.nih.gov/" },
    ],
    'Cool Down': [
      { text: "The session is winding down with fading pink noise. Your auditory system is transitioning back to normal — the muscles have been gently worked, the neural pathways stimulated, and your brain is settling from the binaural entrainment. Abrupt silence after a session can feel jarring, so we taper off gradually.", cite: "Jastreboff, 2015", ref: "Jastreboff PJ. Tinnitus retraining therapy. HNO. 2015.", url: "https://pubmed.ncbi.nlm.nih.gov/26669698/" },
      { text: "After this session, try to avoid immediately putting on loud music or podcasts. Give your ears 5-10 minutes of normal ambient sound. Think of it like not sprinting right after a stretch session. The CDC's safe listening guidelines recommend keeping volume below 85 dB — for reference, a normal conversation is about 60 dB.", cite: "CDC, 2024", ref: "Centers for Disease Control. Noise-Induced Hearing Loss Prevention. 2024.", url: "https://www.cdc.gov/hearing-loss-prevention/" },
      { text: "If you do this consistently — the research protocols used daily sessions over 12 weeks minimum — you're giving your auditory system regular intervals of calibrated, safe stimulation. No study has proven this prevents headphone damage in humans. But the underlying mechanisms are sound, the intensities are safe, and doing something intentional for your ear health beats doing nothing.", cite: "Yin et al., 2020", ref: "Yin Y, et al. Moderate noise strengthens olivocochlear reflex. Auris Nasus Larynx. 2020.", url: "https://pubmed.ncbi.nlm.nih.gov/" },
    ],
  };

  // Track which insights have been shown to avoid repeats
  let shownInsights = {};

  function getNextInsight(phaseName) {
    const pool = phaseInsights[phaseName];
    if (!pool || pool.length === 0) return null;

    if (!shownInsights[phaseName]) shownInsights[phaseName] = [];

    // Find unshown insights
    const available = pool.filter((_, i) => !shownInsights[phaseName].includes(i));

    // If all shown, reset but avoid the last one shown
    if (available.length === 0) {
      const lastShown = shownInsights[phaseName][shownInsights[phaseName].length - 1];
      shownInsights[phaseName] = [lastShown];
      return getNextInsight(phaseName);
    }

    // Pick randomly from available
    const idx = pool.indexOf(available[Math.floor(Math.random() * available.length)]);
    shownInsights[phaseName].push(idx);
    return pool[idx];
  }

  // --- Storage ---
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(`tiq_${key}`)) || fallback; }
      catch { return fallback; }
    },
    set(key, val) { localStorage.setItem(`tiq_${key}`, JSON.stringify(val)); }
  };

  // --- State ---
  const state = {
    isPro: store.get('isPro', false),
    onboarded: store.get('onboarded', false),
    sessions: store.get('sessions', []),
    settings: store.get('settings', {
      baseFreq: 440,
      beatRate: 10,
      tinnitusFreq: 6000,
      notched: false,
      reminder: false,
      musicEnabled: true,
      musicVolume: 30
    })
  };

  function saveState() {
    store.set('isPro', state.isPro);
    store.set('onboarded', state.onboarded);
    store.set('sessions', state.sessions);
    store.set('settings', state.settings);
  }

  // --- Screen Management ---
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // --- Streak Calculation ---
  function calcStreak() {
    if (!state.sessions.length) return { current: 0, best: 0, weekDays: [] };

    const days = [...new Set(state.sessions.map(s => s.date))].sort().reverse();
    const today = new Date().toISOString().split('T')[0];

    let current = 0;
    let checkDate = new Date(today);

    for (let i = 0; i < days.length; i++) {
      const d = new Date(days[i]);
      const expected = new Date(checkDate);
      expected.setDate(expected.getDate() - i);
      if (d.toISOString().split('T')[0] === expected.toISOString().split('T')[0]) {
        current++;
      } else {
        break;
      }
    }

    // Best streak
    let best = 1, run = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const curr = new Date(days[i]);
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (Math.round(diff) === 1) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 1;
      }
    }
    if (days.length === 0) best = 0;

    // This week
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      weekDays.push({
        date: ds,
        done: days.includes(ds),
        isToday: ds === today
      });
    }

    return { current, best, weekDays };
  }

  // --- Dashboard Updates ---
  function updateDashboard() {
    const streak = calcStreak();
    const totalSessions = state.sessions.length;
    const totalMinutes = state.sessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0);
    const thisWeekCount = streak.weekDays.filter(d => d.done).length;

    document.getElementById('streak-count').textContent = streak.current;
    document.getElementById('stat-sessions').textContent = totalSessions;
    document.getElementById('stat-minutes').textContent = totalMinutes;
    document.getElementById('stat-week').textContent = `${thisWeekCount}/7`;

    // Streak dots
    const dotsEl = document.getElementById('streak-dots');
    dotsEl.innerHTML = streak.weekDays.map(d => {
      let cls = 'streak-dot';
      if (d.done) cls += ' done';
      if (d.isToday) cls += ' today';
      return `<div class="${cls}"></div>`;
    }).join('');

    // Pro state
    if (state.isPro) {
      const card = document.querySelector('.session-card[data-mode="deep"]');
      card.classList.remove('locked');
      const badge = document.getElementById('lock-badge-deep');
      if (badge) badge.style.display = 'none';
      const btn = card.querySelector('.btn-start');
      btn.textContent = 'Start Session';
      btn.classList.remove('btn-pro');
    }
  }

  // --- Progress Screen ---
  function updateProgress() {
    const streak = calcStreak();
    const totalSessions = state.sessions.length;
    const totalMinutes = state.sessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0);

    document.getElementById('p-total-sessions').textContent = totalSessions;
    document.getElementById('p-total-minutes').textContent = totalMinutes;
    document.getElementById('p-best-streak').textContent = streak.best;
    document.getElementById('p-current-streak').textContent = streak.current;

    // Calendar (last 35 days)
    const grid = document.getElementById('calendar-grid');
    const today = new Date();
    const sessionDates = state.sessions.map(s => s.date);
    let html = '';

    // Day headers
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
      html += `<div class="cal-day empty" style="font-size:10px;color:var(--text2)">${d}</div>`;
    });

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 34);
    // Align to start of week
    startDate.setDate(startDate.getDate() - startDate.getDay());

    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      let cls = 'cal-day';
      if (sessionDates.includes(ds)) cls += ' has-session';
      if (ds === todayStr) cls += ' today';
      html += `<div class="${cls}">${d.getDate()}</div>`;
    }
    grid.innerHTML = html;

    // Session history
    const histEl = document.getElementById('session-history');
    const recent = [...state.sessions].reverse().slice(0, 20);
    histEl.innerHTML = recent.map(s => {
      const modeNames = { quick: 'Quick Relief', daily: 'Daily Training', deep: 'Deep Conditioning' };
      const mins = Math.round(s.duration / 60);
      return `<div class="history-item">
        <span class="history-mode">${modeNames[s.mode] || s.mode}</span>
        <span class="history-meta">${mins}m · ${s.date}</span>
      </div>`;
    }).join('');
  }

  // --- Settings ---
  function loadSettings() {
    document.getElementById('setting-base-freq').value = state.settings.baseFreq;
    document.getElementById('setting-beat-rate').value = state.settings.beatRate;
    document.getElementById('setting-tinnitus-freq').value = state.settings.tinnitusFreq;
    document.getElementById('setting-notched').checked = state.settings.notched;
    document.getElementById('setting-reminder').checked = state.settings.reminder;
    document.getElementById('setting-music-enabled').checked = state.settings.musicEnabled !== false;
    document.getElementById('setting-music-volume').value = state.settings.musicVolume ?? 30;

    if (state.isPro) {
      document.getElementById('sub-status').style.display = 'none';
      document.getElementById('sub-status-pro').style.display = 'block';
    }

    buildPhasePreview();
  }

  function saveSettings() {
    state.settings.baseFreq = parseInt(document.getElementById('setting-base-freq').value) || 440;
    state.settings.beatRate = parseInt(document.getElementById('setting-beat-rate').value) || 10;
    state.settings.tinnitusFreq = parseInt(document.getElementById('setting-tinnitus-freq').value) || 6000;
    state.settings.notched = document.getElementById('setting-notched').checked;
    state.settings.reminder = document.getElementById('setting-reminder').checked;
    state.settings.musicEnabled = document.getElementById('setting-music-enabled').checked;
    state.settings.musicVolume = parseInt(document.getElementById('setting-music-volume').value);
    musicPlayer.setEnabled(state.settings.musicEnabled);
    musicPlayer.setVolume(state.settings.musicVolume / 100);
    saveState();
  }

  // --- Phase Preview Playlist ---
  function buildPhasePreview() {
    const container = document.getElementById('phase-preview-list');
    if (!container) return;

    // Get all unique phase types from all protocols
    const allPhases = [];
    const seen = new Set();
    ['quick', 'daily', 'deep'].forEach(mode => {
      const protocol = engine.getProtocol(mode, state.settings);
      protocol.phases.forEach(p => {
        if (!seen.has(p.name) && p.type !== 'silence') {
          seen.add(p.name);
          allPhases.push(p);
        }
      });
    });

    container.innerHTML = allPhases.map((p, i) => `
      <div class="phase-preview-row">
        <span class="phase-name">${p.name}</span>
        <span class="phase-type">${p.type.replace('_', ' ')}</span>
        <button class="phase-preview-btn" data-idx="${i}" title="Preview">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
        </button>
      </div>
    `).join('');

    // Store phases for playback
    container._phases = allPhases;

    container.querySelectorAll('.phase-preview-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const isPlaying = btn.classList.contains('playing');

        // Stop any existing preview
        stopPhasePreview();

        if (isPlaying) return;

        // Play this phase
        btn.classList.add('playing');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

        if (!previewEngine) {
          previewEngine = new TympanIQEngine();
        }
        previewEngine.init();
        if (previewEngine.ctx.state === 'suspended') previewEngine.ctx.resume();
        previewEngine.playPhase(allPhases[idx]);

        // Auto-stop after 15 seconds
        previewEngine._previewTimeout = setTimeout(() => stopPhasePreview(), 15000);
      });
    });
  }

  function stopPhasePreview() {
    if (previewEngine) {
      clearTimeout(previewEngine._previewTimeout);
      previewEngine.stopAllNodes();
      previewEngine._currentFadeGain = null;
    }
    document.querySelectorAll('.phase-preview-btn').forEach(b => {
      b.classList.remove('playing');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
    });
  }

  // --- Pre-Session Reminder ---
  let pendingMode = null;

  function showSessionReminder(mode) {
    pendingMode = mode;
    const reminder = document.getElementById('session-reminder');
    reminder.classList.add('active');
  }

  function hideSessionReminder() {
    const reminder = document.getElementById('session-reminder');
    reminder.classList.remove('active');
  }

  // --- Player ---
  function startPlayer(mode) {
    currentMode = mode;
    showScreen('screen-player');

    const modeNames = { quick: 'Quick Relief', daily: 'Daily Training', deep: 'Deep Conditioning' };
    document.getElementById('player-mode-label').textContent = modeNames[mode];

    const durations = { quick: 10, daily: 20, deep: 30 };
    document.getElementById('timer-minutes').textContent = String(durations[mode]).padStart(2, '0');
    document.getElementById('timer-seconds').textContent = '00';

    document.getElementById('icon-play').style.display = 'none';
    document.getElementById('icon-pause').style.display = 'block';

    engine.onTick = (remaining, elapsed, total) => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      document.getElementById('timer-minutes').textContent = String(mins).padStart(2, '0');
      document.getElementById('timer-seconds').textContent = String(secs).padStart(2, '0');
    };

    setupPlayerCallbacks();

    engine.onComplete = (completed, elapsed) => {
      musicPlayer.stop();
      if (completed) {
        state.sessions.push({
          mode: currentMode,
          duration: elapsed,
          date: new Date().toISOString().split('T')[0],
          timestamp: Date.now()
        });
        saveState();
      }
      document.getElementById('icon-play').style.display = 'block';
      document.getElementById('icon-pause').style.display = 'none';
      showScreen('screen-dashboard');
      updateDashboard();
    };

    engine.setVolume(parseInt(document.getElementById('volume-slider').value) / 100);
    engine.startSession(mode, state.settings);

    // Init music player on same audio context
    musicPlayer.init(engine.ctx);
    musicPlayer.setEnabled(state.settings.musicEnabled !== false);
    musicPlayer.setVolume((state.settings.musicVolume ?? 30) / 100);
    musicPlayer.preloadAll();

    // Sync music volume slider
    document.getElementById('music-volume-slider').value = state.settings.musicVolume ?? 30;

    // Start visualizer
    analyser = engine.getAnalyserNode();
    startVisualizer();
  }

  // --- Shared Player Callbacks (used by both full sessions and trial) ---
  function setupPlayerCallbacks() {
    const shortNames = {
      'Broadband Enrichment': 'ENRICH',
      'Alpha Binaural': 'ALPHA',
      'Theta Binaural': 'THETA',
      'Rest Interval': 'REST',
      'Low Frequency Sweep': 'LO SWEEP',
      'Mid Frequency Sweep': 'MID SWEEP',
      'High Frequency Sweep': 'HI SWEEP',
      'Mixed Enrichment': 'MIXED',
      'Notched Audio Therapy': 'NOTCHED',
      'ACRN Neuromodulation': 'ACRN',
      'Cool Down': 'COOL DOWN',
    };
    let ringBuilt = false;

    function arcPath(cx, cy, r, startAngle, endAngle) {
      const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
      const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
      const large = endAngle - startAngle > Math.PI ? 1 : 0;
      return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
    }

    engine.onPhaseProgress = (phaseIdx, phaseProgress, phases) => {
      const svg = document.getElementById('phase-ring');
      const cx = 150, cy = 150, r = 130;
      const totalDur = phases.reduce((s, p) => s + p.duration, 0);
      const gapAngle = 0.03; // small gap between segments
      const startOffset = -Math.PI / 2; // 12 o'clock

      if (!ringBuilt) {
        // Clear old content but keep defs
        const defs = svg.querySelector('defs').outerHTML;
        svg.innerHTML = defs;

        let angleOffset = startOffset;
        phases.forEach((phase, i) => {
          const segAngle = (phase.duration / totalDur) * Math.PI * 2 - gapAngle;
          const segStart = angleOffset + gapAngle / 2;
          const segEnd = segStart + segAngle;

          // Background arc (dimmed, always visible)
          const bgArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          bgArc.setAttribute('d', arcPath(cx, cy, r, segStart, segEnd));
          bgArc.setAttribute('fill', 'none');
          bgArc.setAttribute('stroke', 'rgba(255,255,255,0.06)');
          bgArc.setAttribute('stroke-width', '4');
          bgArc.setAttribute('stroke-linecap', 'round');
          bgArc.id = `seg-bg-${i}`;
          svg.appendChild(bgArc);

          // Progress arc (fills up)
          const fillArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          fillArc.setAttribute('d', arcPath(cx, cy, r, segStart, segEnd));
          fillArc.setAttribute('fill', 'none');
          fillArc.setAttribute('stroke', 'url(#grad-active)');
          fillArc.setAttribute('stroke-width', '4');
          fillArc.setAttribute('stroke-linecap', 'round');
          const arcLen = segAngle * r;
          fillArc.setAttribute('stroke-dasharray', arcLen.toString());
          fillArc.setAttribute('stroke-dashoffset', arcLen.toString());
          fillArc.style.transition = 'stroke-dashoffset 0.8s linear, opacity 0.5s ease';
          fillArc.id = `seg-fill-${i}`;
          svg.appendChild(fillArc);

          // Label — positioned on the inside of the ring at the midpoint of the arc
          const midAngle = segStart + segAngle / 2;
          const labelR = r - 14;
          const lx = cx + labelR * Math.cos(midAngle);
          const ly = cy + labelR * Math.sin(midAngle);

          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('x', lx);
          label.setAttribute('y', ly);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'central');
          label.classList.add('seg-label');
          label.id = `seg-label-${i}`;

          // Rotate text to follow the arc
          const angleDeg = (midAngle * 180 / Math.PI);
          // Flip text on bottom half so it reads correctly
          const flip = (angleDeg > 90 || angleDeg < -90) ? angleDeg + 180 : angleDeg;
          label.setAttribute('transform', `rotate(${flip}, ${lx}, ${ly})`);
          label.textContent = shortNames[phase.name] || phase.name;
          svg.appendChild(label);

          angleOffset = segEnd + gapAngle / 2;
        });

        ringBuilt = true;
      }

      // Update each segment
      let angleOffset2 = startOffset;
      phases.forEach((phase, i) => {
        const segAngle = (phase.duration / totalDur) * Math.PI * 2 - gapAngle;
        const arcLen = segAngle * r;
        const fill = document.getElementById(`seg-fill-${i}`);
        const bg = document.getElementById(`seg-bg-${i}`);
        const label = document.getElementById(`seg-label-${i}`);

        if (i < phaseIdx) {
          // Done
          fill.setAttribute('stroke-dashoffset', '0');
          fill.setAttribute('stroke', 'rgba(99, 102, 241, 0.5)');
          fill.style.opacity = '1';
          bg.setAttribute('stroke', 'rgba(99, 102, 241, 0.15)');
          label.classList.remove('active');
          label.classList.add('done');
        } else if (i === phaseIdx) {
          // Active — fill proportionally
          const offset = arcLen * (1 - Math.min(phaseProgress, 1));
          fill.setAttribute('stroke-dashoffset', offset.toString());
          fill.setAttribute('stroke', 'url(#grad-active)');
          fill.style.opacity = '1';
          bg.setAttribute('stroke', 'rgba(255,255,255,0.08)');
          label.classList.add('active');
          label.classList.remove('done');
        } else {
          // Upcoming
          fill.setAttribute('stroke-dashoffset', arcLen.toString());
          fill.style.opacity = '0';
          bg.setAttribute('stroke', 'rgba(255,255,255,0.05)');
          label.classList.remove('active', 'done');
        }

        angleOffset2 = angleOffset2 + segAngle + gapAngle;
      });
    };

    engine.onPhaseChange = (phase) => {
      // Trigger music for this phase
      if (musicPlayer.ctx) {
        const protocol = engine.protocol;
        const phaseObj = protocol ? protocol.phases.find(p => p === phase) : null;
        const phaseDuration = phaseObj ? phaseObj.duration : 180;

        // Mixed Enrichment: fade music out 15s early for smooth rest transition
        const fadeOutEarly = phase.name === 'Mixed Enrichment' ? 15 : 0;
        musicPlayer.playForPhase(phase.name, phaseDuration, { fadeOutEarly });
      }

      document.getElementById('player-phase-label').textContent = phase.name;
      const insight = getNextInsight(phase.name);
      const container = document.getElementById('phase-explainer');
      const textEl = document.getElementById('phase-explain-text');
      const refBtn = document.getElementById('phase-ref-btn');
      const refPanel = document.getElementById('phase-ref-panel');

      // Close any open ref panel on phase change
      refPanel.classList.remove('open');

      if (insight) {
        // Trigger re-animation by cloning text element
        const newText = textEl.cloneNode(false);
        newText.textContent = insight.text;
        newText.id = 'phase-explain-text';
        newText.className = 'insight-text';
        newText.addEventListener('click', () => newText.classList.toggle('expanded'));
        textEl.parentNode.replaceChild(newText, textEl);

        refBtn.style.display = 'flex';
        refBtn.onclick = (e) => {
          e.stopPropagation();
          refPanel.classList.toggle('open');
        };
        document.getElementById('ref-cite').textContent = insight.cite;
        document.getElementById('ref-full').textContent = insight.ref;
        const refLink = document.getElementById('ref-link');
        refLink.href = insight.url;
        refLink.onclick = (e) => {
          e.stopPropagation();
          window.open(insight.url, '_blank', 'noopener');
          e.preventDefault();
        };
        container.style.opacity = '1';
      } else {
        textEl.textContent = '';
        refBtn.style.display = 'none';
        container.style.opacity = '0';
      }
    };

    engine.onFreqUpdate = (data) => {
      document.getElementById('freq-left').textContent = data.left;
      document.getElementById('freq-right').textContent = data.right;
      document.getElementById('freq-beat').textContent = data.beat;
    };
  }

  // --- Visualizer ---
  function startVisualizer() {
    const canvas = document.getElementById('viz-player');
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    }
    resize();
    window.addEventListener('resize', resize);

    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    let time = 0;

    function draw() {
      vizAnimId = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      time += 0.008;

      ctx.clearRect(0, 0, w, h);

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      const cx = w / 2;
      const cy = h / 2;
      // The orb element is the parent; the canvas overflows by 15% each side
      // so the visual center is the center of the canvas
      const orbRadius = Math.min(w, h) * 0.385; // matches the SVG ring
      const bars = bufferLength;

      // Subtle ambient glow behind the ring
      const ambientGrad = ctx.createRadialGradient(cx, cy, orbRadius * 0.3, cx, cy, orbRadius * 1.2);
      ambientGrad.addColorStop(0, 'rgba(99, 102, 241, 0.04)');
      ambientGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.02)');
      ambientGrad.addColorStop(1, 'rgba(10, 10, 26, 0)');
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, w, h);

      // EQ bars radiating outward from the ring
      for (let i = 0; i < bars; i++) {
        const raw = analyser ? dataArray[i] : (Math.sin(time * 2 + i * 0.3) * 0.5 + 0.5) * 60;
        const val = raw / 255;
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2 + Math.sin(time * 0.5) * 0.02;
        const barHeight = val * orbRadius * 0.7 + 2;

        const x1 = cx + Math.cos(angle) * (orbRadius + 3);
        const y1 = cy + Math.sin(angle) * (orbRadius + 3);
        const x2 = cx + Math.cos(angle) * (orbRadius + 3 + barHeight);
        const y2 = cy + Math.sin(angle) * (orbRadius + 3 + barHeight);

        const alpha = 0.3 + val * 0.7;
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, `rgba(99, 102, 241, ${alpha})`);
        gradient.addColorStop(0.6, `rgba(6, 182, 212, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(6, 182, 212, ${alpha * 0.15})`);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = Math.max(2, (w / bars) * 0.7);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Breathing inner glow — brighter pulse
      const pulseAlpha = 0.06 + Math.sin(time * 1.5) * 0.03;
      const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius * 0.95);
      innerGrad.addColorStop(0, `rgba(99, 102, 241, ${pulseAlpha * 1.5})`);
      innerGrad.addColorStop(0.5, `rgba(6, 182, 212, ${pulseAlpha})`);
      innerGrad.addColorStop(1, 'rgba(10, 10, 26, 0)');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // Outer glow halo
      const outerGrad = ctx.createRadialGradient(cx, cy, orbRadius, cx, cy, orbRadius * 1.3);
      outerGrad.addColorStop(0, `rgba(99, 102, 241, ${0.04 + Math.sin(time) * 0.02})`);
      outerGrad.addColorStop(1, 'rgba(10, 10, 26, 0)');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    draw();
  }

  function stopVisualizer() {
    if (vizAnimId) {
      cancelAnimationFrame(vizAnimId);
      vizAnimId = null;
    }
  }

  // Landing visualizer (ambient)
  function startLandingViz() {
    const canvas = document.getElementById('viz-landing');
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.001,
      vy: (Math.random() - 0.5) * 0.001,
      r: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.1
    }));

    function draw() {
      requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = 'rgba(10, 10, 26, 0.05)';
      ctx.fillRect(0, 0, w, h);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * window.devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${p.alpha})`;
        ctx.fill();
      });

      // Connect nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = (particles[i].x - particles[j].x) * w;
          const dy = (particles[i].y - particles[j].y) * h;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 * window.devicePixelRatio) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x * w, particles[i].y * h);
            ctx.lineTo(particles[j].x * w, particles[j].y * h);
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.1 * (1 - dist / (100 * window.devicePixelRatio))})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    draw();
  }

  // --- PWA Install Prompt ---
  let deferredInstallPrompt = null;

  function isInstalledPWA() {
    // Check display-mode (standalone = installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true; // iOS
    return false;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function showInstallPrompt() {
    const prompt = document.getElementById('install-prompt');
    const installBtn = document.getElementById('btn-install');
    const iosSteps = document.getElementById('install-steps-ios');

    if (isIOS()) {
      // iOS doesn't support beforeinstallprompt — show manual instructions
      installBtn.style.display = 'none';
      iosSteps.style.display = 'block';
    } else if (deferredInstallPrompt) {
      installBtn.style.display = 'block';
      iosSteps.style.display = 'none';
    } else {
      // Neither iOS nor Chrome install prompt available — skip
      return;
    }

    prompt.classList.add('active');
  }

  function hideInstallPrompt() {
    document.getElementById('install-prompt').classList.remove('active');
  }

  function showInstallBanner() {
    if (isInstalledPWA()) return;
    if (store.get('bannerDismissed', false)) return;
    document.getElementById('install-banner').style.display = 'block';
  }

  function hideInstallBanner() {
    document.getElementById('install-banner').style.display = 'none';
  }

  // --- Trial Mode (3 min: 1:30 enrich + 1:30 alpha) ---
  function startTrialSession() {
    currentMode = 'trial';
    showScreen('screen-player');

    document.getElementById('player-mode-label').textContent = 'Free Trial';
    document.getElementById('timer-minutes').textContent = '03';
    document.getElementById('timer-seconds').textContent = '00';
    document.getElementById('icon-play').style.display = 'none';
    document.getElementById('icon-pause').style.display = 'block';

    // Override protocol for trial — 2 phases, 90s each
    const trialProtocol = {
      totalDuration: 180,
      phases: [
        { name: 'Broadband Enrichment', type: 'pink_noise', duration: 90, level: 0.3 },
        { name: 'Alpha Binaural', type: 'binaural', duration: 90, baseFreq: 440, beatFreq: 10, level: 0.35 },
      ]
    };

    engine.onTick = (remaining) => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      document.getElementById('timer-minutes').textContent = String(mins).padStart(2, '0');
      document.getElementById('timer-seconds').textContent = String(secs).padStart(2, '0');
    };

    // Reuse the same phase ring / insight / freq update callbacks from startPlayer
    setupPlayerCallbacks();

    engine.onComplete = (completed, elapsed) => {
      document.getElementById('icon-play').style.display = 'block';
      document.getElementById('icon-pause').style.display = 'none';
      stopVisualizer();
      musicPlayer.stop();

      if (completed) {
        // Trial finished — mark complete and show paywall
        store.set('trialCompleted', true);
        showScreen('screen-dashboard');
        updateDashboard();
        setTimeout(() => showPaywall(), 400);
      } else {
        showScreen('screen-dashboard');
        updateDashboard();
      }
    };

    engine.setVolume(parseInt(document.getElementById('volume-slider').value) / 100);

    // Manually inject the trial protocol and start
    engine.init();
    if (engine.ctx.state === 'suspended') engine.ctx.resume();
    engine.totalDuration = trialProtocol.totalDuration;
    engine.protocol = trialProtocol;
    engine.elapsed = 0;
    engine.isPlaying = true;

    let phaseIndex = 0;
    let phaseElapsed = 0;

    const startPhase = (idx) => {
      if (idx >= trialProtocol.phases.length) {
        engine.stopSession(true);
        return;
      }
      phaseIndex = idx;
      phaseElapsed = 0;
      engine.playPhase(trialProtocol.phases[idx]);
    };

    if (engine.onPhaseProgress) {
      engine.onPhaseProgress(0, 0, trialProtocol.phases);
    }

    startPhase(0);

    engine.sessionTimer = setInterval(() => {
      if (!engine.isPlaying) return;
      engine.elapsed++;
      phaseElapsed++;

      if (engine.onTick) {
        engine.onTick(trialProtocol.totalDuration - engine.elapsed, engine.elapsed, trialProtocol.totalDuration);
      }

      if (engine.onPhaseProgress) {
        const phaseDuration = trialProtocol.phases[phaseIndex].duration;
        engine.onPhaseProgress(phaseIndex, phaseElapsed / phaseDuration, trialProtocol.phases);
      }

      if (engine.elapsed >= trialProtocol.totalDuration) {
        engine.stopSession(true);
        return;
      }

      if (phaseElapsed >= trialProtocol.phases[phaseIndex].duration) {
        startPhase(phaseIndex + 1);
      }
    }, 1000);

    // Start music + visualizer
    musicPlayer.init(engine.ctx);
    musicPlayer.setVolume(state.settings.musicVolume != null ? state.settings.musicVolume / 100 : 0.3);
    musicPlayer.setEnabled(state.settings.musicEnabled !== false);
    musicPlayer.preloadAll();

    analyser = engine.getAnalyserNode();
    startVisualizer();
  }

  // --- Paywall ---
  function showPaywall() {
    document.getElementById('paywall-modal').classList.add('active');
  }

  function hidePaywall() {
    document.getElementById('paywall-modal').classList.remove('active');
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Landing — for non-pro users, go straight to trial
    document.getElementById('btn-get-started').addEventListener('click', () => {
      if (state.isPro) {
        if (state.onboarded) {
          showScreen('screen-dashboard');
          updateDashboard();
        } else {
          showScreen('screen-onboard');
        }
      } else if (state.onboarded) {
        showScreen('screen-dashboard');
        updateDashboard();
      } else {
        showScreen('screen-onboard');
      }
    });

    // Install prompt buttons
    document.getElementById('btn-install').addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        hideInstallPrompt();
        if (result.outcome === 'accepted') {
          store.set('installed', true);
          hideInstallBanner();
        }
      }
    });

    document.getElementById('btn-install-dismiss').addEventListener('click', () => {
      hideInstallPrompt();
      store.set('installDismissed', true);
      store.set('installDismissedAt', Date.now());
      // Show banner as persistent reminder
      showInstallBanner();
    });

    document.getElementById('btn-banner-install').addEventListener('click', async () => {
      if (isIOS()) {
        hideInstallBanner();
        showInstallPrompt();
      } else if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        hideInstallBanner();
        if (result.outcome === 'accepted') {
          store.set('installed', true);
        }
      }
    });

    document.getElementById('btn-banner-dismiss').addEventListener('click', () => {
      hideInstallBanner();
      store.set('bannerDismissed', true);
    });

    // Onboarding
    let onboardStep = 1;
    document.getElementById('btn-onboard-next').addEventListener('click', () => {
      const steps = document.querySelectorAll('.onboard-step');
      const dots = document.querySelectorAll('.dot');
      const btn = document.getElementById('btn-onboard-next');

      steps[onboardStep - 1].classList.remove('active');
      dots[onboardStep - 1].classList.remove('active');

      onboardStep++;
      if (onboardStep > 3) {
        state.onboarded = true;
        saveState();
        showScreen('screen-dashboard');
        updateDashboard();
        return;
      }

      steps[onboardStep - 1].classList.add('active');
      dots[onboardStep - 1].classList.add('active');
      if (onboardStep === 3) btn.textContent = 'Get Started';
    });

    // Session start buttons — show reminder first, trial for non-pro
    document.querySelectorAll('.btn-start').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        if (mode === 'deep' && !state.isPro) {
          showPaywall();
          return;
        }
        if (!state.isPro && !store.get('trialCompleted', false)) {
          // Non-pro, hasn't completed trial yet — run trial
          showSessionReminder('trial');
        } else if (!state.isPro) {
          // Already did trial — show paywall
          showPaywall();
        } else {
          showSessionReminder(mode);
        }
      });
    });

    // Begin session from reminder
    document.getElementById('btn-begin-session').addEventListener('click', () => {
      hideSessionReminder();
      if (pendingMode === 'trial') {
        startTrialSession();
        pendingMode = null;
      } else if (pendingMode) {
        startPlayer(pendingMode);
        pendingMode = null;
      }
    });

    // Player controls
    document.getElementById('btn-play').addEventListener('click', () => {
      if (engine.isPlaying) {
        engine.pause();
        document.getElementById('icon-play').style.display = 'block';
        document.getElementById('icon-pause').style.display = 'none';
      } else {
        engine.resume();
        document.getElementById('icon-play').style.display = 'none';
        document.getElementById('icon-pause').style.display = 'block';
      }
    });

    document.getElementById('btn-stop').addEventListener('click', () => {
      engine.stopSession(false);
      musicPlayer.stop();
      stopVisualizer();
      showScreen('screen-dashboard');
      updateDashboard();
    });

    document.getElementById('btn-back-player').addEventListener('click', () => {
      engine.stopSession(false);
      stopVisualizer();
      showScreen('screen-dashboard');
      updateDashboard();
    });

    // Volume
    document.getElementById('volume-slider').addEventListener('input', (e) => {
      engine.setVolume(parseInt(e.target.value) / 100);
    });

    // Music volume (player)
    document.getElementById('music-volume-slider').addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      musicPlayer.setVolume(val / 100);
      state.settings.musicVolume = val;
      document.getElementById('setting-music-volume').value = val;
      saveState();
    });

    // Nav
    document.getElementById('btn-progress').addEventListener('click', () => {
      updateProgress();
      showScreen('screen-progress');
    });
    document.getElementById('btn-back-progress').addEventListener('click', () => {
      showScreen('screen-dashboard');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      loadSettings();
      showScreen('screen-settings');
    });
    document.getElementById('btn-back-settings').addEventListener('click', () => {
      stopPhasePreview();
      saveSettings();
      showScreen('screen-dashboard');
      updateDashboard();
    });

    // Paywall
    document.getElementById('btn-close-paywall').addEventListener('click', hidePaywall);
    document.querySelector('.modal-overlay').addEventListener('click', hidePaywall);

    document.querySelectorAll('.plan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.plan-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    document.getElementById('btn-subscribe').addEventListener('click', () => {
      // Stripe Payment Element integration
      // When Stripe is configured, this creates a checkout session via your backend
      // and mounts the embedded Payment Element. For now, falls back to simulated mode.
      if (window.STRIPE_PUBLIC_KEY) {
        createStripeCheckout();
      } else {
        // Dev mode — simulate subscription
        state.isPro = true;
        saveState();
        hidePaywall();
        updateDashboard();
        loadSettings();
      }
    });

    document.getElementById('btn-upgrade').addEventListener('click', showPaywall);

    document.getElementById('btn-manage-sub').addEventListener('click', () => {
      // In production, open Stripe customer portal
      alert('Subscription management will open Stripe Customer Portal in production.');
    });

    // Settings auto-save on change
    ['setting-base-freq', 'setting-beat-rate', 'setting-tinnitus-freq'].forEach(id => {
      document.getElementById(id).addEventListener('change', saveSettings);
    });
    ['setting-notched', 'setting-reminder', 'setting-music-enabled'].forEach(id => {
      document.getElementById(id).addEventListener('change', saveSettings);
    });
    document.getElementById('setting-music-volume').addEventListener('input', (e) => {
      saveSettings();
      // Sync the player slider if visible
      document.getElementById('music-volume-slider').value = e.target.value;
    });
  }

  // --- Stripe Payment Element ---
  window.STRIPE_PUBLIC_KEY = 'pk_test_51SfAslQuigt1OfHc52ZIwbFRKhyWffuVLh0pEumCcqwQ0HDIWIzzNCcdGgpchBvPV4pl6te0ZqB5rJ3VR6yS5U8j00rAzuRlBR';
  window.STRIPE_BACKEND_URL = ''; // same origin — uses /api/ routes

  async function createStripeCheckout() {
    const btn = document.getElementById('btn-subscribe');
    const originalText = btn.textContent;
    btn.textContent = 'Loading...';
    btn.disabled = true;

    try {
      const plan = document.querySelector('.plan-btn.active')?.dataset.plan || 'monthly';
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();

      if (data.clientSecret) {
        // Mount embedded Payment Element
        const stripe = window.Stripe(window.STRIPE_PUBLIC_KEY);
        const elements = stripe.elements({
          clientSecret: data.clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#6366f1',
              colorBackground: '#1a1a3e',
              colorText: '#e8e8f0',
              colorDanger: '#ef4444',
              fontFamily: 'Inter, sans-serif',
              borderRadius: '10px'
            }
          }
        });

        const container = document.getElementById('stripe-payment-element');
        container.innerHTML = '';
        container.classList.add('loaded');

        const paymentElement = elements.create('payment', {
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto' }
        });
        paymentElement.mount('#stripe-payment-element');

        // Change button to confirm
        btn.textContent = 'Confirm Payment';
        btn.disabled = false;
        btn.onclick = async () => {
          btn.textContent = 'Processing...';
          btn.disabled = true;

          const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: window.location.origin + '?payment=success' },
            redirect: 'if_required'
          });

          if (error) {
            btn.textContent = 'Try Again';
            btn.disabled = false;
          } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            state.isPro = true;
            saveState();
            hidePaywall();
            updateDashboard();
            loadSettings();
            container.innerHTML = '';
            container.classList.remove('loaded');
          }
        };
      }
    } catch (err) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  // Check for returning from Stripe redirect
  function checkStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      state.isPro = true;
      saveState();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  // --- Init ---
  function init() {
    checkStripeReturn();
    bindEvents();
    startLandingViz();

    // Capture Chrome/Edge install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;

      // Show install prompt if not already installed and not previously dismissed recently
      if (!isInstalledPWA() && !store.get('installed', false)) {
        const dismissedAt = store.get('installDismissedAt', 0);
        const hoursSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60);
        if (!store.get('installDismissed', false) || hoursSinceDismiss > 24) {
          setTimeout(() => showInstallPrompt(), 1500);
        } else {
          showInstallBanner();
        }
      }
    });

    // iOS: show install prompt on first visit if not standalone
    if (isIOS() && !isInstalledPWA() && !store.get('installed', false)) {
      const dismissedAt = store.get('installDismissedAt', 0);
      const hoursSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60);
      if (!store.get('installDismissed', false) || hoursSinceDismiss > 24) {
        setTimeout(() => showInstallPrompt(), 1500);
      } else if (!store.get('bannerDismissed', false)) {
        showInstallBanner();
      }
    }

    // Detect if installed after the fact
    window.addEventListener('appinstalled', () => {
      store.set('installed', true);
      hideInstallPrompt();
      hideInstallBanner();
    });

    if (state.onboarded) {
      // Skip landing on return visits after a brief flash
      setTimeout(() => {
        showScreen('screen-dashboard');
        updateDashboard();
      }, 800);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
