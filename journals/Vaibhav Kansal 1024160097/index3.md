# Journal Entry 8 – Portal Expansion, Complaint Management & UI Cleanup

## Work Done

I expanded the SHARP prototype with a dedicated Mess Manager Portal, improved complaint handling, and made a series of interface and usability refinements across the portals.

## My Contributions

- Added a dedicated Mess Manager Portal and connected the manager role to portal navigation and the demo account switcher.
- Added a Mess Manager registration path with manager details and assigned-mess selection.
- Improved the student complaint form so issue categories match the selected complaint type.
- Added a 72-hour service deadline to new complaints and server-side checks for overdue complaints.
- Added one-time notifications to administrators when open complaints exceed the service deadline.
- Added an Admin Portal complaint overview with open, overdue, and closed counts, complaint status, SLA information, and caretaker assignment or reassignment.
- Restricted caretaker complaint queues to complaints assigned to that caretaker.
- Added API-level tests for complaint submission, caretaker assignment, SLA escalation, and student confirmation of resolution.
- Refined the room-allocation floor map by removing its status legend and changing availability and occupancy count text to black.
- Simplified the student portal UI by removing an informational text box, shortening the closed-allotment message, and replacing the mess-rating dropdown with an interactive star selector.
- Removed sidebar navigation icons across portals and role icons from the demo account list while keeping labels and navigation available.
- Standardized registration button styling and fixed related UI inconsistencies.

## Testing

- Ran JavaScript syntax checks for the updated portal and server files.
- Ran the complaint lifecycle and mess-feedback API tests successfully.

## Outcome

The prototype now has a dedicated manager portal, clearer complaint oversight and escalation, and a more consistent, less cluttered interface across the portals.
