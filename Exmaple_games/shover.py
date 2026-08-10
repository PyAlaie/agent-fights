from BaseEnv import AbstractEnv
from enum import Enum
import numpy as np
import json


max_timestep = 400
initial_stamina = 1000
initial_force = 40
unit_force = 10 
r_lava = initial_force
perf_sq_initial_age = 10

class Actions(Enum):
    MoveUp = 1
    MoveRight = 2
    MoveDown = 3
    MoveLeft = 4
    # BarrierMaker = 5
    # Hellify = 6

Move_to_delta = {
    Actions.MoveUp.value: np.array([-1, 0]),
    Actions.MoveRight.value: np.array([0, 1]),
    Actions.MoveDown.value: np.array([1, 0]),
    Actions.MoveLeft.value: np.array([0, -1]),
}


class Objects(Enum):
    Lava = 2
    Empty = 0
    Box1 = 1
    Barrier = 3

class Main(AbstractEnv):
    def __init__(self):
        self.n_cols = 5
        self.n_rows = 5
        self.number_of_barriers = 2
        self.number_of_boxes = 4
        self.number_of_lavas = 4

        self.moving_positions = {} # stored as {position, direction}
        self.new_moving_positions = {}
        self.stationary_move = False
        self.reward = 0
        self.reset()

        super().__init__()


    def reset(self):
        total = self.n_rows * self.n_cols

        grid = np.zeros((self.n_rows, self.n_cols), dtype=int)

        indices = np.random.choice(total, self.number_of_barriers + self.number_of_boxes + self.number_of_lavas, replace=False)
        barriers_idx = indices[:self.number_of_barriers]
        boxes_idx = indices[self.number_of_barriers:self.number_of_barriers + self.number_of_boxes]
        lavas_idx = indices[self.number_of_barriers + self.number_of_boxes:]

        flat = grid.ravel()
        flat[barriers_idx] = Objects.Barrier.value
        flat[boxes_idx] = Objects.Box1.value
        flat[lavas_idx] = Objects.Lava.value

        self.map = grid.tolist()

    def parse_action(self, action_data):
            parsed_action_data = json.loads(action_data)
            
            action = parsed_action_data.get("action")
            exited = parsed_action_data.get("exited")
            time_passed = parsed_action_data.get("time_passed")
            total_time_passed = parsed_action_data.get("total_time_passed")
    
            return action, exited, time_passed, total_time_passed


    def _out_of_bound(self, i, j):
        if i < 0 or i >= self.n_rows or j < 0 or j >= self.n_cols:
            return True
        return False 

    def _apply_move_action(self, position, action):
        """
            returns:
                1 if there is lava (with award)
                2 if there is a barrier or out of bound (cannot move)
                3 if there was a box that is being moved now so it is empty (chain move)
                4 if it was empty (invalid move)
        """
        
        i, j = position[0], position[1]
        if self._out_of_bound(i,j) or self.map[i][j] == Objects.Barrier.value:
            return 2
        
        if self.map[i][j] == Objects.Lava.value:
            return 1

        # if there is no box...
        if 1 > self.map[i][j] or self.map[i][j] > 10:
            return 4

        new_position = position + Move_to_delta.get(action)
        new_position_status = self._apply_move_action(new_position, action)

        if new_position_status == 1: # if there is lava ahead
            self.step_cost += unit_force
            # self.stamina -= unit_force
            
            # Box is pused into the lava, so its position would be empty and agent gains stamina  
            self.map[i][j] = Objects.Empty.value
            self.step_cost -= initial_force
            # self.stamina += initial_force
            self.reward = initial_force

            return 3 # the box is pushed into the lava, so now its position is empty 
        
        elif new_position_status == 3 or new_position_status == 4: # if the position ahead is now empty
            self.step_cost += unit_force
            # self.stamina -= unit_force

            new_i, new_j = new_position

            the_box = self.map[i][j]
            
            self.map[i][j] = Objects.Empty.value
            self.map[new_i][new_j] = the_box

            return 3 # the box is pushed ahead, so now its position is empty 
        
        else: # if we cannot move shit :|
            return 2

    def step(self, action_data):
        action, exited, time_passed, total_time_assed = self.parse_action(action_data)

        self.step_cost = 0
        position = action["position"]
        z = action["z"]

        self.last_z = z

        # if z == Actions.BarrierMaker.value:
        #     self._apply_barrier_maker_action()
        #     self.moving_positions = {}
        
        # elif z == Actions.Hellify.value:
        #     self._apply_hellify_action()
        #     self.moving_positions = {}

        # else: # Action of moving
        if 1 <= z <= 4:
            res = self._apply_move_action(position, z)

            i, j = position[0], position[1]
            
            if res == 3: # the head box was moved
                if self.moving_positions.get((i,j)) != z:
                    self.step_cost += 40
                    # self.stamina -= initial_force
                
                new_position = position + Move_to_delta.get(z)
                self.moving_positions = {(int(new_position[0]), int(new_position[1])): z}

                # for sq in self.perfect_squares:
                #     if sq.includes(position):
                #         self.perfect_squares.remove(sq)
                #         break
            
            else:
                self.moving_positions = {}
                self.step_cost += 1
                # self.stamina -= 1

    def render(self):
        for i in self.map:
            print(i)

    def _get_observation(self):
        return self.map

    def _get_terminated(self):
        return self.terminated

    def _get_turn(self):
        return 0

    

if __name__ == "__main__":
    a = Main()
    a.render()

    action = {"action": {"position": (1,1), "z":2}}
    action = json.dumps(action)
    a.step(action)
    print("AAA")
    a.render()