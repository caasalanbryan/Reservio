
<?php
/*
|--------------------------------------------------------------------------
| RESERVIO - PUBLIC FACILITY RESERVATION SYSTEM
| PHP + MySQL API
|--------------------------------------------------------------------------
| Authentication, sessions, reservations, facilities and accounts.
| Requires db.php to provide a working $pdo connection.
*/

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");
header("Pragma: no-cache");

date_default_timezone_set("Asia/Manila");

ini_set("session.use_strict_mode", "1");
ini_set("session.use_only_cookies", "1");

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once __DIR__ . "/db.php";

$action = $_GET["action"] ?? "";

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function respond($success, $message = "", $extra = [], $code = 200) {
    http_response_code($code);

    echo json_encode(
        array_merge([
            "success" => $success,
            "message" => $message
        ], $extra),
        JSON_UNESCAPED_UNICODE
    );

    exit;
}

function requestData() {
    $data = json_decode(
        file_get_contents("php://input"),
        true
    );

    if (!is_array($data)) {
        respond(false, "Invalid JSON request.", [], 400);
    }

    return $data;
}

function requireMethod($method) {
    if ($_SERVER["REQUEST_METHOD"] !== $method) {
        header("Allow: " . $method);
        respond(
            false,
            $method . " method required.",
            [],
            405
        );
    }
}

function requireLogin() {
    if (empty($_SESSION["user_id"])) {
        respond(
            false,
            "Please log in first.",
            [],
            401
        );
    }
}

function requireAdmin() {
    requireLogin();

    if (($_SESSION["role"] ?? "") !== "Admin") {
        respond(
            false,
            "Admin access required.",
            [],
            403
        );
    }
}

function positiveId($value) {
    return filter_var(
        $value,
        FILTER_VALIDATE_INT,
        ["options" => ["min_range" => 1]]
    );
}

function validDate($date) {
    if (!is_string($date)) {
        return false;
    }

    $value = DateTimeImmutable::createFromFormat(
        "!Y-m-d",
        $date
    );

    return $value && $value->format("Y-m-d") === $date;
}

function validTime($time) {
    return is_string($time) &&
        preg_match(
            '/^([01]\d|2[0-3]):[0-5]\d$/',
            $time
        ) === 1;
}

function reservationInput($data) {
    $reservation = [
        "customer" => trim($data["customer"] ?? ""),
        "contact" => trim($data["contact"] ?? ""),
        "facilityId" => positiveId($data["facilityId"] ?? null),
        "date" => $data["date"] ?? "",
        "start" => $data["start"] ?? "",
        "end" => $data["end"] ?? "",
        "purpose" => trim($data["purpose"] ?? ""),
        "attendees" => positiveId($data["attendees"] ?? null)
    ];

    if (
        $reservation["customer"] === "" ||
        $reservation["contact"] === "" ||
        !$reservation["facilityId"] ||
        !validDate($reservation["date"]) ||
        !validTime($reservation["start"]) ||
        !validTime($reservation["end"]) ||
        $reservation["start"] >= $reservation["end"] ||
        $reservation["purpose"] === "" ||
        !$reservation["attendees"]
    ) {
        respond(
            false,
            "Please enter valid reservation details.",
            [],
            400
        );
    }

    if ($reservation["date"] < date("Y-m-d")) {
        respond(
            false,
            "Past reservation dates are not allowed.",
            [],
            400
        );
    }

    return $reservation;
}

function checkFacilityAndConflict(
    $pdo,
    $reservation,
    $excludeId = 0
) {
    $facilityStmt = $pdo->prepare(
        "SELECT id, capacity, status
         FROM facilities
         WHERE id = ?
         FOR UPDATE"
    );

    $facilityStmt->execute([
        $reservation["facilityId"]
    ]);

    $facility = $facilityStmt->fetch(PDO::FETCH_ASSOC);

    if (!$facility || $facility["status"] !== "Available") {
        respond(
            false,
            "The selected facility is currently unavailable.",
            [],
            400
        );
    }

    if ($reservation["attendees"] > (int)$facility["capacity"]) {
        respond(
            false,
            "The number of attendees exceeds the facility capacity.",
            [],
            400
        );
    }

    $check = $pdo->prepare(
        "SELECT id
         FROM reservations
         WHERE facility_id = ?
           AND reservation_date = ?
           AND id <> ?
           AND status IN ('Pending', 'Approved')
           AND start_time < ?
           AND end_time > ?
         LIMIT 1"
    );

    $check->execute([
        $reservation["facilityId"],
        $reservation["date"],
        $excludeId,
        $reservation["end"],
        $reservation["start"]
    ]);

    if ($check->fetch()) {
        respond(
            false,
            "This facility is already reserved for the selected date and time.",
            [],
            409
        );
    }
}

try {

    // =================================================
    // SESSION RESTORATION
    // =================================================

    if ($action === "me" || $action === "session") {
        requireMethod("GET");

        requireLogin();

        $stmt = $pdo->prepare(
            "SELECT id, username, name, email, role
             FROM users
             WHERE id = ?
             LIMIT 1"
        );

        $stmt->execute([
            (int)$_SESSION["user_id"]
        ]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $_SESSION = [];
            session_destroy();

            respond(
                false,
                "Your login session has expired.",
                ["loggedIn" => false, "user" => null],
                401
            );
        }

        $_SESSION["role"] = $user["role"];

        respond(
            true,
            "Active session found.",
            [
                "loggedIn" => true,
                "user" => $user
            ]
        );
    }

    // =================================================
    // LOGIN
    // =================================================

    if ($action === "login") {
        requireMethod("POST");

        $data = requestData();

        $username = trim($data["username"] ?? "");
        $password = $data["password"] ?? "";

        if ($username === "" || $password === "") {
            respond(
                false,
                "Please enter your username and password.",
                [],
                400
            );
        }

        $stmt = $pdo->prepare(
            "SELECT id, username, password, name, email, role
             FROM users
             WHERE username = ? OR email = ?
             LIMIT 1"
        );

        $stmt->execute([$username, $username]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (
            !$user ||
            !password_verify($password, $user["password"])
        ) {
            respond(
                false,
                "Invalid username or password.",
                [],
                401
            );
        }

        session_regenerate_id(true);

        $_SESSION["user_id"] = (int)$user["id"];
        $_SESSION["role"] = $user["role"];

        unset($user["password"]);

        respond(
            true,
            "Login successful.",
            ["user" => $user]
        );
    }

    // =================================================
    // LOGOUT
    // =================================================

    if ($action === "logout") {
        requireMethod("POST");

        $_SESSION = [];

        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();

            setcookie(
                session_name(),
                "",
                [
                    "expires" => time() - 3600,
                    "path" => $params["path"],
                    "domain" => $params["domain"],
                    "secure" => $params["secure"],
                    "httponly" => $params["httponly"],
                    "samesite" => $params["samesite"] ?? "Lax"
                ]
            );
        }

        session_destroy();

        respond(
            true,
            "You have successfully logged out."
        );
    }

    // =================================================
    // PUBLIC REGISTRATION
    // =================================================

    if ($action === "register") {
        requireMethod("POST");

        $data = requestData();

        $username = trim($data["username"] ?? "");
        $password = $data["password"] ?? "";
        $name = trim($data["name"] ?? "");
        $email = trim($data["email"] ?? "");

        if (
            $username === "" ||
            $name === "" ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) ||
            strlen($password) < 8
        ) {
            respond(
                false,
                "Please provide valid registration details. Password must contain at least 8 characters.",
                [],
                400
            );
        }

        $check = $pdo->prepare(
            "SELECT id FROM users
             WHERE username = ? OR email = ?
             LIMIT 1"
        );

        $check->execute([$username, $email]);

        if ($check->fetch()) {
            respond(
                false,
                "Username or email already exists.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare(
            "INSERT INTO users
             (
                username, password, name, email,
                phone, address, birthday, gender,
                bio, role, created_at
             )
             VALUES
             (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Staff', CURRENT_TIMESTAMP)"
        );

        $stmt->execute([
            $username,
            password_hash($password, PASSWORD_DEFAULT),
            $name,
            $email,
            $data["phone"] ?? "",
            $data["address"] ?? "",
            !empty($data["birthday"]) ? $data["birthday"] : null,
            $data["gender"] ?? "",
            $data["bio"] ?? ""
        ]);

        respond(
            true,
            "Account created successfully.",
            ["userId" => (int)$pdo->lastInsertId()]
        );
    }

    // =================================================
    // FETCH FACILITIES
    // =================================================

    if ($action === "facilities") {
        requireMethod("GET");

        $stmt = $pdo->query(
            "SELECT id, name, location, capacity, hours, status
             FROM facilities
             ORDER BY name ASC"
        );

        respond(
            true,
            "Facilities loaded successfully.",
            ["facilities" => $stmt->fetchAll(PDO::FETCH_ASSOC)]
        );
    }

    // =================================================
    // ADD / EDIT FACILITY
    // =================================================

    if ($action === "save_facility") {
        requireMethod("POST");
        requireAdmin();

        $data = requestData();

        $id = positiveId($data["id"] ?? null);
        $name = trim($data["name"] ?? "");
        $location = trim($data["location"] ?? "");
        $capacity = positiveId($data["capacity"] ?? null);
        $hours = trim($data["hours"] ?? "");
        $status = $data["status"] ?? "Available";

        if (
            $name === "" ||
            $location === "" ||
            !$capacity ||
            $hours === "" ||
            !in_array(
                $status,
                ["Available", "Unavailable", "Under Maintenance"],
                true
            )
        ) {
            respond(false, "Invalid facility details.", [], 400);
        }

        if ($id) {
            $stmt = $pdo->prepare(
                "UPDATE facilities
                 SET name = ?, location = ?, capacity = ?,
                     hours = ?, status = ?
                 WHERE id = ?"
            );

            $stmt->execute([
                $name, $location, $capacity,
                $hours, $status, $id
            ]);

            $savedId = $id;
        } else {
            $stmt = $pdo->prepare(
                "INSERT INTO facilities
                 (name, location, capacity, hours, status)
                 VALUES (?, ?, ?, ?, ?)"
            );

            $stmt->execute([
                $name, $location, $capacity,
                $hours, $status
            ]);

            $savedId = (int)$pdo->lastInsertId();
        }

        respond(
            true,
            "Facility saved successfully.",
            ["facilityId" => $savedId]
        );
    }

    // =================================================
    // DELETE FACILITY
    // =================================================

    if ($action === "delete_facility") {
        requireMethod("POST");
        requireAdmin();

        $data = requestData();
        $id = positiveId($data["id"] ?? null);

        if (!$id) {
            respond(false, "Invalid facility ID.", [], 400);
        }

        $check = $pdo->prepare(
            "SELECT COUNT(*)
             FROM reservations
             WHERE facility_id = ?"
        );

        $check->execute([$id]);

        if ((int)$check->fetchColumn() > 0) {
            respond(
                false,
                "A facility with existing reservation records cannot be deleted.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare(
            "DELETE FROM facilities WHERE id = ?"
        );

        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            respond(false, "Facility not found.", [], 404);
        }

        respond(true, "Facility deleted successfully.");
    }

    // =================================================
    // FETCH RESERVATIONS
    // =================================================

    if ($action === "reservations") {
        requireMethod("GET");
        requireLogin();

        $stmt = $pdo->query(
            "SELECT
                id, customer, contact, facility_id,
                reservation_date, start_time, end_time,
                purpose, attendees, status,
                created_by, created_at
             FROM reservations
             ORDER BY reservation_date DESC, start_time DESC"
        );

        respond(
            true,
            "Reservations loaded successfully.",
            ["reservations" => $stmt->fetchAll(PDO::FETCH_ASSOC)]
        );
    }

    // =================================================
    // ADD RESERVATION
    // Supports both existing action names
    // =================================================

    if (
        $action === "add_reservation" ||
        $action === "save_reservation"
    ) {
        requireMethod("POST");
        requireLogin();

        $data = requestData();
        $r = reservationInput($data);

        $pdo->beginTransaction();

        try {
            checkFacilityAndConflict($pdo, $r);

            $stmt = $pdo->prepare(
                "INSERT INTO reservations
                 (
                    customer, contact, facility_id,
                    reservation_date, start_time, end_time,
                    purpose, attendees, status, created_by
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)"
            );

            $stmt->execute([
                $r["customer"],
                $r["contact"],
                $r["facilityId"],
                $r["date"],
                $r["start"],
                $r["end"],
                $r["purpose"],
                $r["attendees"],
                (int)$_SESSION["user_id"]
            ]);

            $reservationId = (int)$pdo->lastInsertId();

            $pdo->commit();

            respond(
                true,
                "Reservation submitted successfully.",
                [
                    "reservationId" => $reservationId,
                    "status" => "Pending"
                ]
            );

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    // =================================================
    // EDIT RESERVATION
    // =================================================

    if ($action === "edit_reservation") {
        requireMethod("POST");
        requireAdmin();

        $data = requestData();

        $id = positiveId($data["id"] ?? null);

        if (!$id) {
            respond(false, "Invalid reservation ID.", [], 400);
        }

        $r = reservationInput($data);

        $pdo->beginTransaction();

        try {
            // Lock the selected facility before checking
            // overlapping reservations.
            checkFacilityAndConflict($pdo, $r, $id);

            $existingStmt = $pdo->prepare(
                "SELECT id, status
                 FROM reservations
                 WHERE id = ?
                 FOR UPDATE"
            );

            $existingStmt->execute([$id]);

            $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

            if (
                !$existing ||
                !in_array(
                    $existing["status"],
                    ["Pending", "Approved"],
                    true
                )
            ) {
                $pdo->rollBack();

                respond(
                    false,
                    "This reservation can no longer be edited.",
                    [],
                    409
                );
            }

            $stmt = $pdo->prepare(
                "UPDATE reservations
                 SET customer = ?,
                     contact = ?,
                     facility_id = ?,
                     reservation_date = ?,
                     start_time = ?,
                     end_time = ?,
                     purpose = ?,
                     attendees = ?
                 WHERE id = ?"
            );

            $stmt->execute([
                $r["customer"],
                $r["contact"],
                $r["facilityId"],
                $r["date"],
                $r["start"],
                $r["end"],
                $r["purpose"],
                $r["attendees"],
                $id
            ]);

            $pdo->commit();

            respond(
                true,
                "Reservation updated successfully."
            );

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    // =================================================
    // APPROVE / REJECT RESERVATION
    // =================================================

    if ($action === "update_reservation_status") {
        requireMethod("POST");
        requireAdmin();

        $data = requestData();

        $id = positiveId($data["id"] ?? null);
        $status = $data["status"] ?? "";

        if (
            !$id ||
            !in_array($status, ["Approved", "Rejected"], true)
        ) {
            respond(
                false,
                "Invalid reservation status.",
                [],
                400
            );
        }

        $stmt = $pdo->prepare(
            "UPDATE reservations
             SET status = ?
             WHERE id = ?
               AND status = 'Pending'"
        );

        $stmt->execute([$status, $id]);

        if ($stmt->rowCount() === 0) {
            respond(
                false,
                "Reservation not found or no longer pending.",
                [],
                409
            );
        }

        respond(
            true,
            "Reservation " . strtolower($status) . " successfully."
        );
    }

    // =================================================
    // COMPLETE / CANCEL RESERVATION
    // =================================================

    if ($action === "finish_reservation") {
        requireMethod("POST");
        requireAdmin();

        $data = requestData();

        $id = positiveId($data["id"] ?? null);
        $status = $data["status"] ?? "";

        if (
            !$id ||
            !in_array($status, ["Completed", "Cancelled"], true)
        ) {
            respond(
                false,
                "Invalid reservation status.",
                [],
                400
            );
        }

        if ($status === "Completed") {
            $sql = "UPDATE reservations
                    SET status = 'Completed'
                    WHERE id = ?
                      AND status = 'Approved'";
        } else {
            $sql = "UPDATE reservations
                    SET status = 'Cancelled'
                    WHERE id = ?
                      AND status IN ('Pending', 'Approved')";
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            respond(
                false,
                "Reservation not found or cannot be updated.",
                [],
                409
            );
        }

        respond(
            true,
            "Reservation " . strtolower($status) . " successfully."
        );
    }

    // =================================================
    // FETCH ACCOUNTS
    // =================================================

    if ($action === "accounts") {
        requireMethod("GET");
        requireAdmin();

        $stmt = $pdo->query(
            "SELECT id, username, name, email, role, created_at
             FROM users
             ORDER BY id DESC"
        );

        respond(
            true,
            "Accounts loaded successfully.",
            ["users" => $stmt->fetchAll(PDO::FETCH_ASSOC)]
        );
    }

    // =================================================
    // CREATE ACCOUNT - ADMIN
    // =================================================

    if ($action === "create_account") {
        requireMethod("POST");
        requireAdmin();

        $data = requestData();

        $name = trim($data["name"] ?? "");
        $username = trim($data["username"] ?? "");
        $email = trim($data["email"] ?? "");
        $password = $data["password"] ?? "";
        $role = $data["role"] ?? "Staff";

        if (
            $name === "" ||
            $username === "" ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) ||
            strlen($password) < 8 ||
            !in_array($role, ["Admin", "Staff"], true)
        ) {
            respond(
                false,
                "Please provide valid account details.",
                [],
                400
            );
        }

        $check = $pdo->prepare(
            "SELECT id FROM users
             WHERE username = ? OR email = ?
             LIMIT 1"
        );

        $check->execute([$username, $email]);

        if ($check->fetch()) {
            respond(
                false,
                "Username or email already exists.",
                [],
                409
            );
        }

        $stmt = $pdo->prepare(
            "INSERT INTO users
             (username, password, name, email, role)
             VALUES (?, ?, ?, ?, ?)"
        );

        $stmt->execute([
            $username,
            password_hash($password, PASSWORD_DEFAULT),
            $name,
            $email,
            $role
        ]);

        respond(
            true,
            "Account created successfully.",
            ["userId" => (int)$pdo->lastInsertId()]
        );
    }

    // =================================================
    // EDIT ACCOUNT - ADMIN
    // =================================================

    if ($action === "edit_account") {
        requireMethod("POST");
        requireAdmin();

        $data = requestData();

        $id = positiveId($data["id"] ?? null);
        $name = trim($data["name"] ?? "");
        $username = trim($data["username"] ?? "");
        $email = trim($data["email"] ?? "");
        $password = $data["password"] ?? "";
        $role = $data["role"] ?? "";

        if (
            !$id ||
            $name === "" ||
            $username === "" ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) ||
            !in_array($role, ["Admin", "Staff"], true) ||
            ($password !== "" && strlen($password) < 8)
        ) {
            respond(
                false,
                "Invalid account details.",
                [],
                400
            );
        }

        if (
            $id === (int)$_SESSION["user_id"] &&
            $role !== "Admin"
        ) {
            respond(
                false,
                "You cannot remove your own Admin role.",
                [],
                400
            );
        }

        $check = $pdo->prepare(
            "SELECT id FROM users WHERE id = ? LIMIT 1"
        );

        $check->execute([$id]);

        if (!$check->fetch()) {
            respond(false, "Account not found.", [], 404);
        }

        $duplicate = $pdo->prepare(
            "SELECT id FROM users
             WHERE (username = ? OR email = ?)
               AND id <> ?
             LIMIT 1"
        );

        $duplicate->execute([$username, $email, $id]);

        if ($duplicate->fetch()) {
            respond(
                false,
                "Username or email already exists.",
                [],
                409
            );
        }

        if ($password !== "") {
            $stmt = $pdo->prepare(
                "UPDATE users
                 SET name = ?, username = ?, email = ?,
                     role = ?, password = ?
                 WHERE id = ?"
            );

            $stmt->execute([
                $name,
                $username,
                $email,
                $role,
                password_hash($password, PASSWORD_DEFAULT),
                $id
            ]);
        } else {
            $stmt = $pdo->prepare(
                "UPDATE users
                 SET name = ?, username = ?,
                     email = ?, role = ?
                 WHERE id = ?"
            );

            $stmt->execute([
                $name,
                $username,
                $email,
                $role,
                $id
            ]);
        }

        if ($id === (int)$_SESSION["user_id"]) {
            $_SESSION["role"] = $role;
        }

        respond(
            true,
            "Account updated successfully."
        );
    }

    // =================================================
    // DELETE ACCOUNT - ADMIN
    // =================================================

    if ($action === "delete_account") {
        requireMethod("POST");
        requireAdmin();

        $data = requestData();
        $id = positiveId($data["id"] ?? null);

        if (!$id) {
            respond(false, "Invalid account ID.", [], 400);
        }

        if ($id === (int)$_SESSION["user_id"]) {
            respond(
                false,
                "You cannot delete your own account.",
                [],
                403
            );
        }

        $stmt = $pdo->prepare(
            "DELETE FROM users WHERE id = ?"
        );

        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            respond(false, "Account not found.", [], 404);
        }

        respond(
            true,
            "Account deleted successfully."
        );
    }

    // =================================================
    // UNKNOWN ACTION
    // =================================================

    respond(
        false,
        "Invalid API action.",
        [],
        404
    );

} catch (PDOException $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "Reservio database error: " . $e->getMessage()
    );

    respond(
        false,
        "Database operation failed. Please try again.",
        [],
        500
    );

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log(
        "Reservio API error: " . $e->getMessage()
    );

    respond(
        false,
        "An unexpected server error occurred.",
        [],
        500
    );
}
