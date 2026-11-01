package handlers

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

type UserHandler struct {
	userSvc service.UserService
}

func NewUserHandler(userSvc service.UserService) *UserHandler {
	return &UserHandler{userSvc: userSvc}
}

// CheckUsername checks format, reserved blocklist, and database availability.
// @Summary Check username availability
// @Description Checks if a requested username is available and valid
// @Tags Users
// @Produce json
// @Param u query string true "Username to check"
// @Success 200 {object} domain.Response{data=domain.CheckUsernameResponse}
// @Router /v1/users/username [get]
func (h *UserHandler) CheckUsername(c *fiber.Ctx) error {
	u := strings.TrimSpace(c.Query("u"))
	resp, err := h.userSvc.CheckUsername(c.Context(), u)
	if err != nil {
		return err
	}
	return domain.SendOKMsg(c, resp, "Username checked")
}

// GetMe retrieves the authenticated user's profile.
// @Summary Get current user profile
// @Description Retrieves the authenticated caller's profile
// @Tags Users
// @Security BearerAuth
// @Produce json
// @Success 200 {object} domain.Response{data=domain.UserResponse}
// @Failure 401 {object} domain.Response
// @Router /v1/users/me [get]
func (h *UserHandler) GetMe(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	resp, err := h.userSvc.GetMe(c.Context(), userID)
	if err != nil {
		return err
	}
	return domain.SendOK(c, resp, nil)
}

// SetUsername claims a username one-time for a verified user.
// @Summary Set one-time username
// @Description Claims a unique username for the authenticated user
// @Tags Users
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body domain.SetUsernameRequest true "Username Payload"
// @Success 200 {object} domain.Response{data=domain.UserResponse}
// @Failure 400 {object} domain.Response
// @Failure 409 {object} domain.Response
// @Router /v1/users/username [post]
func (h *UserHandler) SetUsername(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req domain.SetUsernameRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.userSvc.SetUsername(c.Context(), userID, req)
	if err != nil {
		return err
	}

	return domain.SendOKMsg(c, resp, "Username set successfully")
}

// UpdateProfile updates the authenticated user's first and last name.
// @Summary Update user profile
// @Description Updates the user's first name and last name
// @Tags Users
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body domain.UpdateUserRequest true "Profile Payload"
// @Success 200 {object} domain.Response{data=domain.UserResponse}
// @Failure 400 {object} domain.Response
// @Router /v1/users/update [put]
func (h *UserHandler) UpdateProfile(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req domain.UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.userSvc.UpdateProfile(c.Context(), userID, req)
	if err != nil {
		return err
	}

	return domain.SendOKMsg(c, resp, "Profile updated successfully")
}
