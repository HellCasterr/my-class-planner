const { DateTime } = luxon;
const STORAGE_KEY = 'chess-class-planner';
const WEEKS_TO_PROJECT = 12;
const DEFAULT_COACH_TIMEZONE = 'Asia/Kolkata';

const state = {
  coachTimezone: DEFAULT_COACH_TIMEZONE,
  students: [],
};

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayToNumber = Object.fromEntries(dayNames.map((day, index) => [day, index + 1]));

const coachTimezoneSelect = document.querySelector('#coach-timezone');
const studentTimezoneSelect = document.querySelector('#student-timezone');
const classesPerWeekSelect = document.querySelector('#classes-per-week');
const weeklySlotsContainer = document.querySelector('#weekly-slots');
const studentForm = document.querySelector('#student-form');
const statsGrid = document.querySelector('#stats-grid');
const studentSummary = document.querySelector('#student-summary');
const scheduleList = document.querySelector('#schedule-list');
const rescheduleDialog = document.querySelector('#reschedule-dialog');
const rescheduleForm = document.querySelector('#reschedule-form');
const rescheduleTimezoneSelect = document.querySelector('#reschedule-timezone');
const cancelRescheduleButton = document.querySelector('#cancel-reschedule');
const closeRescheduleButton = document.querySelector('#close-reschedule');
const slotRowTemplate = document.querySelector('#slot-row-template');

init();

function init() {
  hydrateState();
  populateTimezoneSelect(coachTimezoneSelect, state.coachTimezone);
  populateTimezoneSelect(studentTimezoneSelect, 'Asia/Dubai');
  populateTimezoneSelect(rescheduleTimezoneSelect, state.coachTimezone);
  coachTimezoneSelect.value = state.coachTimezone;
  studentForm.elements.startDate.value = DateTime.now().toISODate();
  renderWeeklySlotInputs(Number(classesPerWeekSelect.value));
  render();

  classesPerWeekSelect.addEventListener('change', (event) => {
    renderWeeklySlotInputs(Number(event.target.value));
  });

  coachTimezoneSelect.addEventListener('change', (event) => {
    state.coachTimezone = event.target.value;
    persistState();
    render();
  });

  studentForm.addEventListener('submit', handleStudentSubmit);
  scheduleList.addEventListener('click', handleScheduleActions);
  cancelRescheduleButton.addEventListener('click', () => rescheduleDialog.close());
  closeRescheduleButton.addEventListener('click', () => rescheduleDialog.close());
  rescheduleForm.addEventListener('submit', handleRescheduleSubmit);
}

function hydrateState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.coachTimezone = parsed.coachTimezone || DEFAULT_COACH_TIMEZONE;
    state.students = Array.isArray(parsed.students) ? parsed.students : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function populateTimezoneSelect(select, preferredZone) {
  const supportedZones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [DEFAULT_COACH_TIMEZONE, 'Asia/Dubai', 'UTC'];

  select.innerHTML = supportedZones
    .map((zone) => `<option value="${zone}">${zone}</option>`)
    .join('');

  if (supportedZones.includes(preferredZone)) {
    select.value = preferredZone;
  }
}

function renderWeeklySlotInputs(count) {
  weeklySlotsContainer.innerHTML = '';
  for (let index = 0; index < count; index += 1) {
    const fragment = slotRowTemplate.content.cloneNode(true);
    const row = fragment.querySelector('.slot-row');
    const daySelect = row.querySelector('.slot-day');
    const timeInput = row.querySelector('.slot-time');

    daySelect.name = `slot-day-${index}`;
    timeInput.name = `slot-time-${index}`;

    if (index === 0) {
      daySelect.value = 'Tuesday';
      timeInput.value = '14:00';
    } else if (index === 1) {
      daySelect.value = 'Friday';
      timeInput.value = '14:00';
    }

    weeklySlotsContainer.appendChild(fragment);
  }
}

function handleStudentSubmit(event) {
  event.preventDefault();
  const formData = new FormData(studentForm);
  const classesPerWeek = Number(formData.get('classesPerWeek'));
  const weeklySlots = [];

  for (let index = 0; index < classesPerWeek; index += 1) {
    weeklySlots.push({
      day: formData.get(`slot-day-${index}`),
      time: formData.get(`slot-time-${index}`),
    });
  }

  const student = {
    id: crypto.randomUUID(),
    name: String(formData.get('name')).trim(),
    age: Number(formData.get('age')),
    country: String(formData.get('country')).trim(),
    timezone: String(formData.get('timezone')),
    totalClasses: Number(formData.get('totalClasses')),
    classesPerWeek,
    startDate: String(formData.get('startDate')),
    weeklySlots,
    generatedClasses: generateClasses({
      startDate: String(formData.get('startDate')),
      timezone: String(formData.get('timezone')),
      totalClasses: Number(formData.get('totalClasses')),
      weeklySlots,
      coachTimezone: state.coachTimezone,
    }),
  };

  state.students.unshift(student);
  persistState();
  studentForm.reset();
  studentForm.elements.startDate.value = DateTime.now().toISODate();
  studentTimezoneSelect.value = 'Asia/Dubai';
  classesPerWeekSelect.value = '2';
  renderWeeklySlotInputs(2);
  render();
}

function generateClasses({ startDate, timezone, totalClasses, weeklySlots, coachTimezone }) {
  const classes = [];
  const start = DateTime.fromISO(startDate, { zone: timezone }).startOf('day');
  let weekOffset = 0;

  while (classes.length < totalClasses && weekOffset < WEEKS_TO_PROJECT) {
    weeklySlots.forEach((slot) => {
      if (classes.length >= totalClasses) {
        return;
      }

      const projected = start
        .plus({ weeks: weekOffset })
        .set({ weekday: dayToNumber[slot.day] });

      const [hour, minute] = slot.time.split(':').map(Number);
      let studentDateTime = projected.set({ hour, minute, second: 0, millisecond: 0 });

      if (studentDateTime < start) {
        studentDateTime = studentDateTime.plus({ weeks: 1 });
      }

      const utcIso = studentDateTime.toUTC().toISO();
      classes.push({
        id: crypto.randomUUID(),
        originalUtc: utcIso,
        currentUtc: utcIso,
        studentLocalLabel: formatClassDate(utcIso, timezone),
        coachLocalLabel: formatClassDate(utcIso, coachTimezone),
        status: DateTime.fromISO(utcIso) < DateTime.utc() ? 'completed' : 'upcoming',
        rescheduled: false,
      });
    });

    weekOffset += 1;
  }

  return classes.sort((left, right) => left.currentUtc.localeCompare(right.currentUtc));
}

function formatClassDate(utcIso, timezone) {
  return DateTime.fromISO(utcIso, { zone: 'utc' })
    .setZone(timezone)
    .toFormat("ccc, dd LLL yyyy 'at' h:mm a ZZZZ");
}

function deriveStudentMetrics(student) {
  const completedClasses = student.generatedClasses.filter((item) => DateTime.fromISO(item.currentUtc) < DateTime.utc()).length;
  const upcomingClasses = student.generatedClasses.length - completedClasses;
  return {
    completedClasses,
    upcomingClasses,
    remainingClasses: Math.max(student.totalClasses - completedClasses, 0),
  };
}

function render() {
  populateTimezoneSelect(rescheduleTimezoneSelect, state.coachTimezone);
  renderStats();
  renderStudentSummary();
  renderScheduleList();
}

function renderStats() {
  const totalStudents = state.students.length;
  const totalUpcoming = state.students.flatMap((student) => student.generatedClasses)
    .filter((item) => DateTime.fromISO(item.currentUtc) >= DateTime.utc()).length;
  const totalCompleted = state.students.flatMap((student) => student.generatedClasses)
    .filter((item) => DateTime.fromISO(item.currentUtc) < DateTime.utc()).length;

  statsGrid.innerHTML = [
    { label: 'Students', value: totalStudents },
    { label: 'Upcoming classes', value: totalUpcoming },
    { label: 'Completed classes', value: totalCompleted },
    { label: 'Coach timezone', value: state.coachTimezone },
  ]
    .map((item) => `
      <article class="stat-card">
        <p class="hint">${item.label}</p>
        <strong>${item.value}</strong>
      </article>
    `)
    .join('');
}

function renderStudentSummary() {
  if (state.students.length === 0) {
    studentSummary.className = 'student-summary empty-state';
    studentSummary.textContent = 'Add your first student to see the calendar dashboard.';
    return;
  }

  studentSummary.className = 'student-summary';
  studentSummary.innerHTML = state.students
    .map((student) => {
      const metrics = deriveStudentMetrics(student);
      const slots = student.weeklySlots
        .map((slot) => {
          const sampleUtc = DateTime.fromObject({ hour: Number(slot.time.split(':')[0]), minute: Number(slot.time.split(':')[1]) }, { zone: student.timezone }).toUTC();
          const coachTime = sampleUtc.setZone(state.coachTimezone).toFormat('h:mm a');
          return `${slot.day} ${slot.time} (${student.timezone}) → ${coachTime} (${state.coachTimezone})`;
        })
        .join('<br />');

      return `
        <article class="student-card">
          <header>
            <div>
              <h3>${student.name}</h3>
              <p class="hint">Age ${student.age} · ${student.country}</p>
            </div>
            <span class="badge upcoming">${metrics.upcomingClasses} upcoming</span>
          </header>
          <div class="summary-grid">
            <div class="meta-list">
              <span><strong>${student.totalClasses}</strong>Total planned classes</span>
              <span><strong>${metrics.completedClasses}</strong>Completed classes</span>
            </div>
            <div class="meta-list">
              <span><strong>${student.classesPerWeek}</strong>Classes per week</span>
              <span><strong>${metrics.remainingClasses}</strong>Remaining classes</span>
            </div>
          </div>
          <div class="meta-list">
            <span>Student timezone: ${student.timezone}</span>
            <span>Coach timezone: ${state.coachTimezone}</span>
            <span>Weekly slots:<br />${slots}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderScheduleList() {
  const cards = state.students
    .flatMap((student) => student.generatedClasses.map((classItem) => ({ student, classItem })))
    .sort((left, right) => left.classItem.currentUtc.localeCompare(right.classItem.currentUtc));

  if (cards.length === 0) {
    scheduleList.className = 'schedule-list empty-state';
    scheduleList.textContent = 'No classes scheduled yet.';
    return;
  }

  scheduleList.className = 'schedule-list';
  scheduleList.innerHTML = cards
    .map(({ student, classItem }) => {
      const isUpcoming = DateTime.fromISO(classItem.currentUtc) >= DateTime.utc();
      const badgeClass = classItem.rescheduled ? 'rescheduled' : isUpcoming ? 'upcoming' : 'completed';
      const badgeText = classItem.rescheduled ? 'Rescheduled' : isUpcoming ? 'Upcoming' : 'Completed';
      return `
        <article class="class-card">
          <header>
            <div>
              <h3>${student.name}</h3>
              <p class="hint">${student.country} · ${student.timezone}</p>
            </div>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </header>
          <div class="class-meta">
            <span><strong>Student time:</strong> ${formatClassDate(classItem.currentUtc, student.timezone)}</span>
            <span><strong>Coach time:</strong> ${formatClassDate(classItem.currentUtc, state.coachTimezone)}</span>
            <span><strong>Original slot:</strong> ${formatClassDate(classItem.originalUtc, student.timezone)}</span>
          </div>
          <footer>
            <span class="hint">${isUpcoming ? 'Upcoming classes can be changed individually.' : 'Past classes count as completed automatically.'}</span>
            ${isUpcoming ? `<button class="ghost-button" data-action="reschedule" data-student-id="${student.id}" data-class-id="${classItem.id}">Reschedule</button>` : ''}
          </footer>
        </article>
      `;
    })
    .join('');
}

function handleScheduleActions(event) {
  const target = event.target.closest('[data-action="reschedule"]');
  if (!target) {
    return;
  }

  const student = state.students.find((item) => item.id === target.dataset.studentId);
  const classItem = student?.generatedClasses.find((item) => item.id === target.dataset.classId);

  if (!student || !classItem) {
    return;
  }

  const currentStudentTime = DateTime.fromISO(classItem.currentUtc, { zone: 'utc' }).setZone(student.timezone);
  rescheduleForm.elements.studentId.value = student.id;
  rescheduleForm.elements.classId.value = classItem.id;
  rescheduleForm.elements.date.value = currentStudentTime.toISODate();
  rescheduleForm.elements.time.value = currentStudentTime.toFormat('HH:mm');
  rescheduleTimezoneSelect.value = student.timezone;
  rescheduleDialog.showModal();
}

function handleRescheduleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(rescheduleForm);
  const student = state.students.find((item) => item.id === formData.get('studentId'));
  const classItem = student?.generatedClasses.find((item) => item.id === formData.get('classId'));

  if (!student || !classItem) {
    return;
  }

  const timezone = String(formData.get('timezone'));
  const [hour, minute] = String(formData.get('time')).split(':').map(Number);
  const updated = DateTime.fromISO(String(formData.get('date')), { zone: timezone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });

  classItem.currentUtc = updated.toUTC().toISO();
  classItem.rescheduled = true;
  classItem.status = DateTime.fromISO(classItem.currentUtc) < DateTime.utc() ? 'completed' : 'upcoming';
  persistState();
  rescheduleDialog.close();
  render();
}
