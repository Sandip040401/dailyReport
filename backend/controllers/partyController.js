// controllers/partyController.js
import Party from '../models/Party.js';
import DailyPayment from '../models/DailyPayment.js';
import MultiDayPayment from '../models/MultiDayPayment.js';

// controllers/partyController.js
export const createParty = async (req, res) => {
  try {
    const { partyName, partyCode, partyType } = req.body;

    // Validation
    if (!partyName || !partyCode || !partyType) {
      return res.status(400).json({ 
        success: false,
        message: 'Party name, code, and type are required' 
      });
    }

    // Validate partyType
    if (!['daily', 'multiday'].includes(partyType.toLowerCase())) {
      return res.status(400).json({ 
        success: false,
        message: 'Party type must be either "daily" or "multiday"' 
      });
    }

    const existingParty = await Party.findOne({
      $or: [{ partyName }, { partyCode: partyCode.toUpperCase() }]
    });

    if (existingParty) {
      return res.status(400).json({ 
        success: false,
        message: 'Party already exists' 
      });
    }

    const party = new Party({
      partyName,
      partyCode: partyCode.toUpperCase(),
      partyType: partyType.toLowerCase(),
      weekStartDate: new Date()
    });

    await party.save();

    res.status(201).json({
      success: true,
      message: 'Party created successfully',
      data: party
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateParty = async (req, res) => {
  try {
    const { id } = req.params;
    const { partyName, partyCode, partyType } = req.body;

    // Validate partyType if provided
    if (partyType && !['daily', 'multiday'].includes(partyType.toLowerCase())) {
      return res.status(400).json({ 
        success: false,
        message: 'Party type must be either "daily" or "multiday"' 
      });
    }

    const updateData = {
      partyName,
      partyCode: partyCode.toUpperCase(),
      lastUpdated: Date.now()
    };

    if (partyType) {
      updateData.partyType = partyType.toLowerCase();
    }

    const party = await Party.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!party) {
      return res.status(404).json({ 
        success: false,
        message: 'Party not found' 
      });
    }

    res.json({
      success: true,
      message: 'Party updated successfully',
      data: party
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getAllParties = async (req, res) => {
  try {
    const parties = await Party.find().sort({ partyName: 1 });

    res.status(200).json({
      success: true,
      count: parties.length,
      data: parties
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPartyDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { weekNumber } = req.query;

    const party = await Party.findById(id);

    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }

    let payments = [];
    if (weekNumber) {
      const daily = await DailyPayment.find({ party: id, weekNumber: parseInt(weekNumber) });
      const multi = await MultiDayPayment.find({ party: id, weekNumber: parseInt(weekNumber) });
      payments = [...daily, ...multi];
    }

    res.status(200).json({
      success: true,
      data: {
        party,
        payments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const deactivateParty = async (req, res) => {
  try {
    const { id } = req.params;

    const party = await Party.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!party) {
      return res.status(404).json({ message: 'Party not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Party deactivated successfully',
      data: party
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getDailyParties = async (req, res) => {
  try {
    const parties = await Party.find({ partyType: 'daily' }).sort({ partyName: 1 });
    res.status(200).json({
      success: true,
      count: parties.length,
      data: parties
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getMultiDayParties = async (req, res) => {
  try {
    const parties = await Party.find({ partyType: 'multiday' }).sort({ partyName: 1 });
    res.status(200).json({
      success: true,
      count: parties.length,
      data: parties
    });
  }
  catch (error) {  
    res.status(500).json({ success: false, message: error.message });
  }
};
