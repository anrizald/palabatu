package approaches

// validStartTypes mirrors the approaches_start_type_check DB constraint
// (migrations/0017) -- the local-first part of the design (handoff.md
// decision 21): every global climbing app assumes a car, this one assumes
// angkot/ojek as readily.
var validStartTypes = map[string]bool{
	"angkot": true,
	"ojek":   true,
	"motor":  true,
	"mobil":  true,
	"kaki":   true,
}

func validateStartType(t string) error {
	if !validStartTypes[t] {
		return ErrInvalidStartType
	}
	return nil
}

// validateSteps enforces "an approach is an ordered list of steps, each a
// photo plus one line" (handoff.md decision 21) -- at least one step, and
// every step needs both a photo and a caption. Position is assigned by
// array order at the service layer, not trusted from a client field.
func validateSteps(steps []CreateApproachStepInput) error {
	if len(steps) == 0 {
		return ErrNoSteps
	}
	for _, s := range steps {
		if s.PhotoURL == "" || s.Caption == "" {
			return ErrInvalidStep
		}
	}
	return nil
}
