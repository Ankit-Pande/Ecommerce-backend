import { Router } from "express";
import { createAddress, deleteAddress, listAddresses, updateAddress } from "../controller/address.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import { addressIdSchema, createAddressSchema, updateAddressSchema } from "../validation/address.validation";

const router = Router();

router.use(authCheck);

router.get("/", listAddresses);
router.post("/", validate(createAddressSchema), createAddress);
router.patch("/:id", validate(updateAddressSchema), updateAddress);
router.delete("/:id", validate(addressIdSchema), deleteAddress);

export const addressRoutes = router;
