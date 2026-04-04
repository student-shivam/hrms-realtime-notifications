const Salary = require('../models/Salary');
const Employee = require('../models/Employee');

// @desc    Get my salary history
// @route   GET /api/salary/my
// @access  Private
exports.getMySalaryHistory = async (req, res) => {
  try {
    const history = await Salary.find({ userId: req.user.id }).sort('-year -month');
    
    // Also get current settings from Employee record
    const employee = await Employee.findOne({ email: req.user.email });

    res.status(200).json({
      success: true,
      data: {
        history,
        currentSettings: employee ? {
          base: employee.salary,
          details: employee.salaryDetails
        } : null
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Add salary record (Admin only)
// @route   POST /api/salary
// @access  Private (Admin only)
exports.addSalaryRecord = async (req, res) => {
  try {
    const { userId, month, year, baseSalary, hra, bonus, allowances, deductions, status } = req.body;

    const parsedBaseSalary = Number(baseSalary) || 0;
    const parsedHra = Number(hra) || 0;
    const parsedBonus = Number(bonus) || 0;
    const parsedAllowances = Number(allowances) || 0;
    const parsedDeductions = Number(deductions) || 0;
    
    const netSalary = (parsedBaseSalary + parsedHra + parsedBonus + parsedAllowances) - parsedDeductions;

    const salary = await Salary.create({
      userId,
      month,
      year,
      baseSalary: parsedBaseSalary,
      hra: parsedHra,
      bonus: parsedBonus,
      allowances: parsedAllowances,
      deductions: parsedDeductions,
      netSalary,
      status: status || 'Paid'
    });

    res.status(201).json({
      success: true,
      data: salary
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
