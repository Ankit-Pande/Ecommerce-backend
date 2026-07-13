import { Router } from "express";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../controller/address.controller";
import { authCheck } from "../middleware/authCheck";
import { validate } from "../middleware/validate";
import {
  createAddressSchema,
  updateAddressSchema,
  addressIdSchema,
} from "../validation/address.validation";

const router = Router();

// Sab login-protected (apna hi address dikhe/badle).
router.use(authCheck);

router.get("/", listAddresses);
router.post("/", validate(createAddressSchema), createAddress);
router.patch("/:id", validate(updateAddressSchema), updateAddress);
router.delete("/:id", validate(addressIdSchema), deleteAddress);

export const addressRoutes = router;
