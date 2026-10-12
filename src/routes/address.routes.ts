import { Router } from "express";
import { createAddress, deleteAddress, listAddresses, updateAddress } from "../controller/address.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import { createAddressSchema, updateAddressSchema } from "../validation/address.validation";
import { idParamSchema } from "../validation/common";

const router = Router();

router.use(authCheck);

router.get("/", listAddresses);
router.post("/", validate(createAddressSchema), createAddress);
router.patch("/:id", validate(updateAddressSchema), updateAddress);
router.delete("/:id", validate(idParamSchema), deleteAddress);

export const addressRoutes = router;
