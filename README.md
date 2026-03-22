# Chess Class Planner

A lightweight frontend app for planning recurring chess classes across student and coach timezones.

## Features

- Register students with name, age, country, timezone, total classes, and classes per week.
- Enter recurring weekly slots in the student's local timezone.
- Automatically project the next 12 weeks of classes and convert them into the coach timezone.
- Track completed vs upcoming classes, including when the start date is in the past.
- Reschedule any individual upcoming class from the dashboard.
- Persist the whole planner in browser local storage.

## Usage

Open `index.html` in a browser. The app is fully client-side and uses Luxon from a CDN for timezone-aware scheduling.
