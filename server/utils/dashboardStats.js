const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const dateKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatActivityTime = (value) => new Date(value).toISOString();

const buildRecentActivities = async () => {
  const [recentEmployees, recentLeaves, recentAttendance] = await Promise.all([
    Employee.find().sort('-createdAt').limit(4).lean(),
    Leave.find().populate('userId', 'name').sort('-updatedAt').limit(4).lean(),
    Attendance.find()
      .populate('userId', 'name')
      .sort('-updatedAt')
      .limit(6)
      .lean()
  ]);

  const activities = [
    ...recentEmployees.map((employee) => ({
      id: `employee-${employee._id}`,
      type: 'employee',
      color: 'primary',
      title: `${employee.name} was added to ${employee.department || 'the organization'}`,
      timestamp: formatActivityTime(employee.createdAt)
    })),
    ...recentLeaves.map((leave) => ({
      id: `leave-${leave._id}`,
      type: 'leave',
      color: leave.status === 'Approved' ? 'success' : leave.status === 'Rejected' ? 'secondary' : 'warning',
      title: `${leave.userId?.name || 'An employee'} leave request is ${String(leave.status || 'Pending').toLowerCase()}`,
      timestamp: formatActivityTime(leave.updatedAt || leave.createdAt)
    })),
    ...recentAttendance.map((attendance) => ({
      id: `attendance-${attendance._id}`,
      type: 'attendance',
      color: attendance.status === 'Checked Out' ? 'success' : 'primary',
      title: `${attendance.userId?.name || 'An employee'} ${attendance.status === 'Checked Out' ? 'checked out' : 'checked in'}`,
      timestamp: formatActivityTime(attendance.updatedAt || attendance.createdAt)
    }))
  ];

  return activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 6);
};

const fetchDashboardStats = async () => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

  const sevenDayStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));

  const [
    totalEmployees,
    departmentNames,
    todayAttendanceRows,
    activeLeaveCount,
    yearlyAttendanceRows,
    sevenDayAttendanceRows,
    sevenDayLeaveRows,
    recentActivity
  ] = await Promise.all([
    Employee.countDocuments(),
    Employee.distinct('department', { department: { $exists: true, $ne: '' } }),
    Attendance.find({
      date: { $gte: todayStart, $lte: todayEnd }
    }).select('userId status').lean(),
    Leave.countDocuments({
      status: 'Approved',
      fromDate: { $lte: todayEnd },
      toDate: { $gte: todayStart }
    }),
    Attendance.aggregate([
      {
        $match: {
          date: { $gte: yearStart, $lte: yearEnd }
        }
      },
      {
        $group: {
          _id: { month: { $month: '$date' } },
          checkedIn: {
            $sum: {
              $cond: [{ $in: ['$status', ['Present', 'Checked Out']] }, 1, 0]
            }
          },
          checkedOut: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Checked Out'] }, 1, 0]
            }
          }
        }
      }
    ]),
    Attendance.find({
      date: { $gte: sevenDayStart, $lte: todayEnd }
    }).select('date status userId').lean(),
    Leave.find({
      status: 'Approved',
      fromDate: { $lte: todayEnd },
      toDate: { $gte: sevenDayStart }
    }).select('fromDate toDate').lean(),
    buildRecentActivities()
  ]);

  const todayUniqueUsers = new Set(todayAttendanceRows.map((row) => String(row.userId)));
  const presentToday = todayAttendanceRows.filter((row) => row.status === 'Present').length;
  const checkedOutToday = todayAttendanceRows.filter((row) => row.status === 'Checked Out').length;
  const leaveCount = activeLeaveCount;
  const absentToday = Math.max(0, totalEmployees - presentToday - checkedOutToday - leaveCount);

  const monthlyMap = new Map(
    yearlyAttendanceRows.map((row) => [
      row._id.month,
      { checkedIn: row.checkedIn || 0, checkedOut: row.checkedOut || 0 }
    ])
  );

  const monthlyAttendance = MONTH_LABELS.map((label, index) => {
    const monthNumber = index + 1;
    const monthStats = monthlyMap.get(monthNumber) || { checkedIn: 0, checkedOut: 0 };
    return {
      label,
      checkedIn: monthStats.checkedIn,
      checkedOut: monthStats.checkedOut
    };
  });

  const sevenDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sevenDayStart);
    day.setDate(sevenDayStart.getDate() + index);
    return day;
  });

  const sevenDayMap = new Map(
    sevenDays.map((day) => [dateKey(day), {
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      date: dateKey(day),
      present: 0,
      checkedOut: 0,
      leave: 0,
      absent: totalEmployees
    }])
  );

  const uniqueAttendanceByDay = new Map();

  sevenDayAttendanceRows.forEach((row) => {
    const key = dateKey(row.date);
    if (!sevenDayMap.has(key)) return;

    const dayStats = sevenDayMap.get(key);
    const uniqueKey = `${key}:${row.userId}`;
    if (!uniqueAttendanceByDay.has(uniqueKey)) {
      uniqueAttendanceByDay.set(uniqueKey, true);
    }

    if (row.status === 'Checked Out') {
      dayStats.checkedOut += 1;
    } else if (row.status === 'Present') {
      dayStats.present += 1;
    }
  });

  sevenDayLeaveRows.forEach((leave) => {
    const effectiveStart = new Date(Math.max(startOfDay(leave.fromDate).getTime(), sevenDayStart.getTime()));
    const leaveEnd = new Date(Math.min(endOfDay(leave.toDate).getTime(), todayEnd.getTime()));
    const cursor = effectiveStart;

    while (cursor <= leaveEnd) {
      const key = dateKey(cursor);
      if (sevenDayMap.has(key)) {
        sevenDayMap.get(key).leave += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const lastSevenDays = Array.from(sevenDayMap.values()).map((dayStats) => ({
    ...dayStats,
    absent: Math.max(0, totalEmployees - dayStats.present - dayStats.checkedOut - dayStats.leave)
  }));

  return {
    totalEmployees,
    presentToday,
    absentToday,
    checkedOutToday,
    leaveCount,
    totalDepartments: departmentNames.length,
    activeAttendanceToday: todayUniqueUsers.size,
    monthlyAttendance,
    lastSevenDays,
    todayBreakdown: [
      { label: 'Present', value: presentToday },
      { label: 'Checked Out', value: checkedOutToday },
      { label: 'On Leave', value: leaveCount },
      { label: 'Absent', value: absentToday }
    ],
    recentActivity,
    generatedAt: new Date().toISOString()
  };
};

const emitDashboardUpdate = async (req, source = 'system') => {
  try {
    const io = req.app.get('io');
    if (!io) {
      return null;
    }

    const stats = await fetchDashboardStats();
    const payload = {
      source,
      stats
    };

    io.to('admins').emit('dashboardUpdate', payload);
    io.emit('dashboardUpdate', payload);
    return stats;
  } catch (error) {
    console.error(`emitDashboardUpdate error (${source}):`, error.message);
    return null;
  }
};

module.exports = {
  fetchDashboardStats,
  emitDashboardUpdate
};
