// controllers/projectController.js
import projectModel from '../models/projectModel.js';

// Helper to get default phases based on projectType
const getDefaultPhases = (projectType) => {
  switch (projectType) {
    case 'logo_design':
      return [
        { name: 'Research & Concept', status: 'pending', tasks: [], milestones: [] },
        { name: 'Design Iteration', status: 'pending', tasks: [], milestones: [] },
        { name: 'Finalization', status: 'pending', tasks: [], milestones: [] },
      ];
    case 'branding':
      return [
        { name: 'Brand Strategy', status: 'pending', tasks: [], milestones: [] },
        { name: 'Visual Identity', status: 'pending', tasks: [], milestones: [] },
        { name: 'Guidelines Development', status: 'pending', tasks: [], milestones: [] },
      ];
    case 'web_development':
      return [
        { name: 'Planning & Wireframing', status: 'pending', tasks: [], milestones: [] },
        { name: 'Development', status: 'pending', tasks: [], milestones: [] },
        { name: 'Testing & Deployment', status: 'pending', tasks: [], milestones: [] },
      ];
    case 'app_development':
      return [
        { name: 'Requirement Gathering', status: 'pending', tasks: [], milestones: [] },
        { name: 'Development', status: 'pending', tasks: [], milestones: [] },
        { name: 'Testing & Launch', status: 'pending', tasks: [], milestones: [] },
      ];
    default:
      return [{ name: 'Initial Phase', status: 'pending', tasks: [], milestones: [] }];
  }
};

// Create Project
export const createProject = async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const defaultPhases = getDefaultPhases(req.body.projectType);
    const newProjectData = { ...req.body, client: userId, phases: defaultPhases };
    const project = await projectModel.create(newProjectData);

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update Project
export const updateProject = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const project = await projectModel.findOne({ _id: projectId, client: userId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied',
      });
    }

    const updatedProject = await projectModel.findByIdAndUpdate(
      projectId,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    return res.json({
      success: true,
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Projects
export const getProjects = async (req, res) => {
  const userId = req.userId;
  const role = req.userRole;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    let projects = [];

    if (role === 'admin') {
      projects = await projectModel
        .find()
        .populate('client', 'name avatar phone email')
        .sort({ createdAt: -1 });
    } else if (role === 'consultant') {
      projects = await projectModel
        .find({ 'teamMembers.user': userId })
        .populate('client', 'name avatar phone email')
        .sort({ createdAt: -1 });
    } else {
      projects = await projectModel
        .find({ client: userId })
        .populate('client', 'name avatar phone email')
        .sort({ createdAt: -1 });
    }

    return res.json({ success: true, projects });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Project by ID
export const getProjectById = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.userId;
  const role = req.userRole;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const project = await projectModel
      .findById(projectId)
      .populate('client', 'name avatar phone email');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const isOwner = project.client._id.toString() === userId;
    const isTeamMember = project.teamMembers.some(member => member.user.toString() === userId);

    if (role === 'admin' || isOwner || (role === 'consultant' && isTeamMember)) {
      return res.json({ success: true, project });
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Project
export const deleteProject = async (req, res) => {
  const { projectId } = req.params;
  const userId = req.userId;
  const role = req.userRole;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const project = await projectModel.findById(projectId);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const isOwner = project.client._id.toString() === userId;

    if (role === 'admin' || isOwner) {
      await projectModel.findByIdAndDelete(projectId);
      return res.json({ success: true, message: 'Project deleted successfully' });
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};