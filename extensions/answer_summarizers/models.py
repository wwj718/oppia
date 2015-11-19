# coding: utf-8
#
# Copyright 2014 The Oppia Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS-IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Classes for calculations to get interaction answer views."""

__author__ = 'Marcel Schmittfull'

import collections
import copy
import os

from core.domain import stats_domain
import feconf
import schema_utils
import utils


"""
Calculations performed on recorded state answers.

NOTE TO DEVELOPERS: To specify calculations desired for an interaction named
<INTERACTION_NAME>, edit

    extensions.interactions.<INTERACTION_NAME>.answer_visualizations

This is a list of visualizations, each of which is specified by a dict
with keys 'id', 'options' and 'calculation_id'. An example for a single
visualization and calculation may look like this:

    answer_visualizations = [{
        'id': 'BarChart',
        'options': {
            'x_axis_label': 'Answer',
            'y_axis_label': 'Count',
        },
        'calculation_id': 'AnswerFrequencies',
    }]
"""


class BaseCalculation(object):
    """
    Base calculation class.

    This is the superclass for all calculations used to generate interaction
    answer views.
    """

    @property
    def id(self):
        return self.__class__.__name__

    def calculate_from_state_answers_entity(self, state_answers):
        """Perform calculation on a single StateAnswers entity. This is run
        in the context of a batch MapReduce job.

        This method must be overwritten in subclasses.
        """
        raise NotImplementedError(
            'Subclasses of BaseCalculation should implement the '
            'calculate_from_state_answers_entity(state_answers) method.')


class AnswerFrequencies(BaseCalculation):
    """Calculation for answers' frequencies (how often each answer was
    submitted).
    """
    def calculate_from_state_answers_entity(self, state_answers):
        """Computes the number of occurrences of each answer, and returns a
        list of dicts; each dict has keys 'answer' and 'frequency'.

        This method is run from within the context of a MapReduce job.
        """

        answer_values = [
            answer_dict['answer_value']
            for answer_dict  in state_answers.answers_list]

        answer_counts_as_list_of_pairs = (
            collections.Counter(answer_values).items())

        calculation_output = []
        for item in answer_counts_as_list_of_pairs:
            calculation_output.append({
                'answer': item[0],
                'frequency': item[1],
            })

        return stats_domain.StateAnswersCalcOutput(
            state_answers.exploration_id,
            state_answers.exploration_version,
            state_answers.state_name,
            self.id,
            calculation_output)


class Top5AnswerFrequencies(BaseCalculation):
    """Calculation for the top 5 answers, by frequency."""

    def calculate_from_state_answers_entity(self, state_answers):
        """Computes the number of occurrences of each answer, keeping only
        the top 5 answers, and returns a list of dicts; each dict has keys
        'answer' and 'frequency'.

        This method is run from within the context of a MapReduce job.
        """

        answer_values = [
            answer_dict['answer_value']
            for answer_dict in state_answers.answers_list]

        top_5_answer_counts_as_list_of_pairs = (
            sorted(collections.Counter(answer_values).items(),
                   key=lambda x: x[1],
                   reverse=True)[:5])

        calculation_output = []
        for item in top_5_answer_counts_as_list_of_pairs:
            calculation_output.append({
                'answer': item[0],
                'frequency': item[1],
            })

        return stats_domain.StateAnswersCalcOutput(
            state_answers.exploration_id,
            state_answers.exploration_version,
            state_answers.state_name,
            self.id,
            calculation_output)


class FrequencyCommonlySubmittedElements(BaseCalculation):
    """Calculation for determining the frequency of commonly submitted elements
    among multiple set answers (such as of type SetOfUnicodeString).
    """

    def calculate_from_state_answers_entity(self, state_answers):
        """Computes the number of occurrences of each element across
        all given answers, keeping only the top 10 elements. Returns a
        list of dicts; each dict has keys 'element' and 'frequency'.

        This method is run from within the context of a MapReduce job.
        """

        # Get a list of stringified sets, e.g. [u"[u'abc', u'www']",
        # u"[u'abc']", u"[u'xyz']", u"[u'xyz', u'abc']"]
        answer_values = [
            answer_dict['answer_value']
            for answer_dict in state_answers.answers_list]

        # For each stringified set, replace '[' and ']' by empty string,
        # and split at commas ', ' to convert string to set.
        # TODO(msl): This will yield wrong results if answers contain ',',
        # '[', or ']'. Consider saving sets instead of stringified sets.
        list_of_all_elements = []
        for setstring in answer_values:
            elts_this_set = (
                setstring.replace('[','').replace(']','').split(', '))
            list_of_all_elements += elts_this_set

        elements_as_list_of_pairs = sorted(
            collections.Counter(list_of_all_elements).items(),
            key=lambda x: x[1],
            reverse=True)
        # Keep only top 10 elements
        if len(elements_as_list_of_pairs) > 10:
            elements_as_list_of_pairs = elements_as_list_of_pairs[:10]

        calculation_output = []
        for item in elements_as_list_of_pairs:
            # Save element with key 'answer' so it gets displayed correctly
            # by FrequencyTable visualization.
            calculation_output.append({
                'answer': item[0],
                'frequency': item[1],
            })

        return stats_domain.StateAnswersCalcOutput(
            state_answers.exploration_id,
            state_answers.exploration_version,
            state_answers.state_name,
            self.id,
            calculation_output)
