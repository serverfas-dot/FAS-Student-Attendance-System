# School Attendance System - User Guide

## System Overview

A comprehensive school attendance management system with role-based access control for administrators and teachers.

## Default Login Credentials

**Admin Account:**
- Email: `admin@school.com`
- Password: `admin123`

**Important:** Change the admin password after first login.

## User Roles

### Administrator
Full system access including:
- Grade management (create, edit, delete grades)
- Student management (add, edit, remove students)
- Teacher management (create teacher accounts, assign permissions)
- Attendance editing (can edit any attendance record)
- Comprehensive reporting (daily, monthly, yearly, individual student)

### Teacher
Limited access based on assigned permissions:
- Mark attendance only for assigned grades
- Cannot edit previously marked attendance
- Can only mark attendance for current date

## Key Features

### Grade Management
- Create grades with academic year
- Track total boys, girls, and total students per grade
- Each grade is associated with an academic year

### Student Management
- Add students with unique index numbers
- Track student name, gender, and grade assignment
- Search and filter students by name, index, or grade
- Students can be deactivated (soft delete)

### Teacher Management
- Create teacher accounts with email and password
- Assign grade permissions to teachers
- Teachers can only mark attendance for grades they have permission for
- Admins control all permission assignments

### Attendance Marking
Four attendance statuses available:
- **Present**: Student is present
- **Absent**: Student is absent
- **Sick**: Student is absent due to illness
- **Late**: Student arrived late

**Teacher Rules:**
- Can only mark attendance for today's date
- Cannot edit previously marked attendance
- Can only mark for grades they have permission for

**Admin Rules:**
- Can mark and edit attendance for any date
- Can modify any attendance record
- Full access to all grades

### Attendance Reports

**Daily Report:**
- View attendance for a specific date
- Shows all students and their status for that day
- Overall statistics (present, absent, sick, late)

**Monthly Report:**
- View attendance summary for entire month
- Student-by-student breakdown
- Attendance rate calculation for each student

**Yearly Report:**
- Full year attendance summary
- Comprehensive statistics per student
- Overall grade performance metrics

**Individual Student Report:**
- Complete attendance history for specific student
- Yearly breakdown of all attendance records
- Attendance percentage calculation

## Database Structure

### Tables
1. **users** - Admin and teacher accounts
2. **grades** - Grade/class information
3. **students** - Student records
4. **attendance** - Daily attendance records
5. **teacher_grade_permissions** - Teacher access control

### Security
- Row Level Security (RLS) enabled on all tables
- Role-based access policies
- Admins have full access
- Teachers have restricted access based on permissions
- All data is protected and auditable

## Getting Started

1. **Login as Admin**
   - Use default credentials to login
   - Change the default password immediately

2. **Create Grades**
   - Go to "Grades" tab
   - Add all grades/classes for the academic year
   - Set total boys and girls for each grade

3. **Add Students**
   - Go to "Students" tab
   - Add students with unique index numbers
   - Assign students to their respective grades

4. **Create Teacher Accounts**
   - Go to "Teachers" tab
   - Add teacher accounts with email and password
   - Assign grade permissions to each teacher

5. **Mark Attendance**
   - Teachers login and select their assigned grade
   - Mark attendance status for each student
   - Save attendance records

6. **Generate Reports**
   - Admins can generate various reports
   - Choose report type and date range
   - View detailed statistics and attendance rates

## System Limitations

- Teachers cannot edit attendance once marked
- Teachers can only mark attendance for current date
- Only admins can edit historical attendance records
- Student index numbers must be unique
- Teacher email addresses must be unique

## Technical Details

- Built with React, TypeScript, and Tailwind CSS
- Database: Supabase PostgreSQL
- Authentication: Custom implementation with bcrypt
- Real-time data synchronization
- Responsive design for all devices
