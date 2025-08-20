# Attendance Management System (AMS)

A comprehensive web-based attendance management system built with HTML, CSS, JavaScript, and Firebase Firestore.

## Features

- **User Authentication**
  - Secure login and registration
  - Email/password authentication
  - Session management

- **Dashboard**
  - Real-time attendance statistics
  - Digital clock with date
  - Quick overview of present/absent employees

- **Employee Management**
  - Add, edit, and delete employee records
  - Track employee details (ID, Name, CNIC, Mobile)
  - Employee status management (Active/Inactive)

- **Attendance Tracking**
  - Mark attendance with multiple statuses (Present, Absent, Leave, OFF, WFH, DO)
  - Add comments for Leave and DO statuses
  - Update previous attendance records
  - Bulk mark all as present

- **Reporting**
  - Daily attendance reports
  - Monthly calendar view
  - Employee-specific reports
  - Export to Excel/PDF (placeholder)

## Prerequisites

- Firebase account (https://firebase.google.com/)
- Modern web browser with JavaScript enabled

## Setup Instructions

1. **Create a Firebase Project**
   - Go to the [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password)
   - Create a Firestore Database in production mode
   - Get your Firebase configuration

2. **Configure Firebase**
   - Open `firebase-config.js`
   - Replace the placeholder values with your Firebase project configuration

3. **Deploy the Application**
   - You can host this on any static web hosting service (Firebase Hosting, Netlify, Vercel, etc.)
   - For local development, you can use a simple HTTP server like `http-server` or `live-server`

## Project Structure

```
ams-attendance-app/
├── css/
│   └── style.css           # Main stylesheet
├── js/
│   ├── app.js             # Core application logic
│   ├── auth.js            # Authentication functions
│   ├── dashboard.js       # Dashboard functionality
│   ├── employees.js       # Employee management
│   ├── attendance.js      # Attendance tracking
│   ├── reports.js         # Reporting functionality
│   └── firebase-config.js # Firebase configuration
├── index.html             # Login/Registration
├── dashboard.html         # Main dashboard
├── employees.html         # Employee management
├── attendance.html        # Attendance marking
├── reports.html           # Reports
└── README.md             # This file
```

## Security Rules (Firestore)

Set up the following security rules in your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Additional security rules can be added here
    // to restrict access to specific collections/documents
  }
}
```

## Usage

1. **Login**
   - Open `index.html` in a web browser
   - Register a new account or login with existing credentials

2. **Dashboard**
   - View attendance statistics at a glance
   - Navigate to different sections using the sidebar

3. **Manage Employees**
   - Add new employees with their details
   - Edit or remove existing employee records
   - Update employee status

4. **Mark Attendance**
   - Select a date to view/edit attendance
   - Choose status for each employee
   - Add comments for Leave/DO statuses
   - Save attendance records

5. **Generate Reports**
   - View daily attendance reports
   - Browse monthly calendar view
   - Export reports (placeholder)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For support, please open an issue in the GitHub repository.
