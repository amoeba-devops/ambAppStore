export { CarError, type ActionResult } from './car-error.js';
export {
  ASSIGNMENT_WARNING_CODES,
  CONFIRM_REQUIRED_CODE,
  isConfirmRequiredDetails,
  type AssignmentWarning,
  type AssignmentWarningCode,
} from './assignment-guard.js';
export {
  VEHICLE_UNDER_MAINTENANCE_CODE,
  MAINTENANCE_HAS_TRIPS_CODE,
  isMaintenanceBlockDetails,
  isMaintenanceTripsDetails,
  type MaintenanceBlockDetails,
  type MaintenanceTripsDetails,
} from './maintenance-guard.js';
