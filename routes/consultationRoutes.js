import express from 'express';
import { assignHandler, checkEmail, createConsultation, deleteById, getConsultationById, getConsultations, updateById} from '../controllers/consultationController.js';
import userAuth from "../middleware/userAuth.js";

const consultationRouter = express.Router();

consultationRouter.post('/check-email', checkEmail);     
consultationRouter.post('/create-consultation', createConsultation);       
consultationRouter.get('/get-consultations', userAuth , getConsultations); 
consultationRouter.get('/get-consultations/:id', userAuth , getConsultationById);
consultationRouter.patch('/update/:id', userAuth , updateById);
consultationRouter.patch('/assign-handler/:id', userAuth , assignHandler);
consultationRouter.delete('/delete/:id', userAuth , deleteById);

export default consultationRouter;